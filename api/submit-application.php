<?php

const MAX_REQUEST_BYTES = 16384;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 600;
const DUPLICATE_LIMIT_MAX = 2;
const DUPLICATE_LIMIT_WINDOW_SECONDS = 1800;
const MIN_FORM_TIME_SECONDS = 2;
const MAX_FORM_AGE_SECONDS = 86400;
const ALLOWED_ORIGINS = [
    'https://g10.kirov.restoved.ru',
    'https://www.g10.kirov.restoved.ru',
];

function response_json($status, $body, $headers = [])
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    foreach ($headers as $name => $value) {
        header($name . ': ' . $value);
    }
    if ($status !== 204) {
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    exit;
}

function request_method()
{
    return strtoupper((string) (isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET'));
}

function client_ip()
{
    // Do not trust client-supplied forwarding headers. The hosting proxy must
    // pass the real client address to REMOTE_ADDR for rate limiting.
    $remoteAddress = trim((string) (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : ''));
    return $remoteAddress !== '' ? $remoteAddress : 'unknown';
}

function clean_string($value, $maxLength)
{
    $value = is_scalar($value) ? (string) $value : '';
    $value = str_replace(["\0", "\r", "\n"], '', trim($value));
    return function_exists('mb_substr') ? mb_substr($value, 0, $maxLength, 'UTF-8') : substr($value, 0, $maxLength);
}

function normalize_application(array $body)
{
    $consent = isset($body['consent']) ? $body['consent'] : false;
    return [
        'name' => clean_string(isset($body['name']) ? $body['name'] : '', 120),
        'phone' => clean_string(isset($body['phone']) ? $body['phone'] : '', 32),
        'email' => strtolower(clean_string(isset($body['email']) ? $body['email'] : '', 160)),
        'source' => clean_string(isset($body['source']) ? $body['source'] : '', 80) ?: 'unknown',
        'plan' => clean_string(isset($body['plan']) ? $body['plan'] : '', 40),
        'website' => clean_string(isset($body['website']) ? $body['website'] : '', 120),
        'form_started_at' => (int) (isset($body['form_started_at']) ? $body['form_started_at'] : 0),
        'consent' => in_array($consent, [true, 'true', 'on', '1', 1], true),
    ];
}

function validate_application(array $application)
{
    if ($application['name'] === '' || (function_exists('mb_strlen') ? mb_strlen($application['name'], 'UTF-8') : strlen($application['name'])) < 2) {
        return 'Укажите имя и фамилию.';
    }
    if (!preg_match('/^\+?[0-9()\s-]{7,32}$/', $application['phone'])) {
        return 'Проверьте номер телефона.';
    }
    if (!filter_var($application['email'], FILTER_VALIDATE_EMAIL)) {
        return 'Проверьте e-mail.';
    }
    if (!$application['consent']) {
        return 'Нужно согласие на обработку персональных данных.';
    }
    if ($application['plan'] !== '' && !in_array($application['plan'], ['Оптима', 'Корпоратив'], true)) {
        return 'Неизвестный тариф.';
    }
    return null;
}

function request_origin_is_allowed()
{
    $origin = trim((string) (isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : ''));
    if ($origin === '') {
        return true;
    }

    return in_array($origin, ALLOWED_ORIGINS, true);
}

function rate_limit_directory()
{
    $directory = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'g10-kirov-application-rate';
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Rate-limit storage is unavailable');
    }
    if (!is_writable($directory)) {
        throw new RuntimeException('Rate-limit storage is unavailable');
    }
    return $directory;
}

function rate_limit_file($key)
{
    return rate_limit_directory() . DIRECTORY_SEPARATOR . hash('sha256', $key) . '.json';
}

function check_rate_limit($key, $max, $windowSeconds)
{
    $path = rate_limit_file($key);
    $handle = @fopen($path, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Rate-limit file is unavailable');
    }
    if (!@flock($handle, LOCK_EX)) {
        fclose($handle);
        throw new RuntimeException('Rate-limit lock is unavailable');
    }

    $contents = stream_get_contents($handle);
    $stored = json_decode($contents ?: '[]', true);
    $now = time();
    $timestamps = [];
    if (is_array($stored)) {
        foreach ($stored as $timestamp) {
            $timestamp = (int) $timestamp;
            if ($timestamp > $now - $windowSeconds) {
                $timestamps[] = $timestamp;
            }
        }
    }

    $allowed = count($timestamps) < $max;
    if ($allowed) {
        $timestamps[] = $now;
    }

    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($timestamps, JSON_UNESCAPED_SLASHES));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    return [
        'allowed' => $allowed,
        'retry_after' => $allowed || $timestamps === [] ? 0 : max(1, ($timestamps[0] + $windowSeconds) - $now),
    ];
}

function environment_value($name, $default = '')
{
    $value = getenv($name);
    if (!is_string($value) || trim($value) === '') {
        return $default;
    }
    return trim($value);
}

function telegram_settings()
{
    $token = environment_value('G10_TELEGRAM_BOT_TOKEN');
    $chatId = environment_value('G10_TELEGRAM_CHAT_ID');

    if (!preg_match('/^[0-9]+:[A-Za-z0-9_-]+$/', $token) || !preg_match('/^-?[0-9]+$/', $chatId)) {
        throw new RuntimeException('Telegram settings are not configured.');
    }

    return [
        'token' => $token,
        'chat_id' => $chatId,
    ];
}

function telegram_request($url, array $fields)
{
    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        if ($handle === false) {
            return false;
        }
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_POSTFIELDS => $fields,
        ]);
        $response = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $error = curl_error($handle);
        curl_close($handle);

        if (!is_string($response) || $error !== '' || $status < 200 || $status >= 300) {
            return false;
        }
        return $response;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query($fields, '', '&'),
            'timeout' => 5,
            'ignore_errors' => true,
        ],
    ]);
    $response = @file_get_contents($url, false, $context);
    return is_string($response) ? $response : false;
}

function send_application_to_telegram(array $application)
{
    $settings = telegram_settings();
    $text = implode("\n", [
        'Новая заявка G10 Киров',
        'Имя: ' . $application['name'],
        'Телефон: ' . $application['phone'],
        'Email: ' . $application['email'],
        'Тариф: ' . ($application['plan'] !== '' ? $application['plan'] : 'не выбран'),
        'Источник формы: ' . $application['source'],
    ]);
    $url = 'https://api.telegram.org/bot' . $settings['token'] . '/sendMessage';
    $response = telegram_request($url, [
        'chat_id' => $settings['chat_id'],
        'text' => $text,
    ]);
    if ($response === false) {
        error_log('G10 Kirov Telegram request failed.');
        return false;
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded) || empty($decoded['ok'])) {
        error_log('G10 Kirov Telegram rejected the application.');
        return false;
    }

    $messageId = isset($decoded['result']['message_id']) ? (int) $decoded['result']['message_id'] : 0;
    error_log('G10 Kirov Telegram delivery accepted; message_id=' . $messageId . '.');
    return true;
}

$method = request_method();
if ($method === 'OPTIONS') {
    response_json(204, [], ['Allow' => 'POST, OPTIONS']);
}
if ($method !== 'POST') {
    response_json(405, ['ok' => false, 'message' => 'Метод не поддерживается.'], ['Allow' => 'POST, OPTIONS']);
}
if (!request_origin_is_allowed()) {
    response_json(403, ['ok' => false, 'message' => 'Запрос отклонён.']);
}

$contentLength = (int) (isset($_SERVER['CONTENT_LENGTH']) ? $_SERVER['CONTENT_LENGTH'] : 0);
if ($contentLength > MAX_REQUEST_BYTES) {
    response_json(413, ['ok' => false, 'message' => 'Заявка слишком большая.']);
}

$rawBody = file_get_contents('php://input');
$body = json_decode($rawBody ?: '', true);
if (!is_array($body)) {
    response_json(400, ['ok' => false, 'message' => 'Некорректный формат заявки.']);
}

$application = normalize_application($body);
// A filled hidden field means the request came from a bot. Return success so
// the bot does not learn that it was filtered.
if ($application['website'] !== '') {
    response_json(200, ['ok' => true]);
}

$validationMessage = validate_application($application);
if ($validationMessage !== null) {
    response_json(400, ['ok' => false, 'message' => $validationMessage]);
}

$now = time();
if ($application['form_started_at'] > 0) {
    $formAge = $now - $application['form_started_at'];
    if ($formAge < MIN_FORM_TIME_SECONDS) {
        response_json(429, ['ok' => false, 'message' => 'Подождите пару секунд и отправьте форму ещё раз.']);
    }
    if ($formAge > MAX_FORM_AGE_SECONDS) {
        response_json(400, ['ok' => false, 'message' => 'Форма устарела. Обновите страницу и заполните её снова.']);
    }
}

$ip = client_ip();
$applicationKey = hash('sha256', strtolower($application['email']) . '|' . preg_replace('/\D+/', '', $application['phone']));
try {
    $ipLimit = check_rate_limit('ip|' . $ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS);
    $duplicateLimit = check_rate_limit('application|' . $applicationKey, DUPLICATE_LIMIT_MAX, DUPLICATE_LIMIT_WINDOW_SECONDS);
} catch (Exception $error) {
    error_log('G10 Kirov application rate limiter is unavailable.');
    // Do not lose a legitimate application because a shared host denies access
    // to its temporary directory. Honeypot, validation, origin and time checks
    // still run; the host should be fixed so persistent rate limiting resumes.
    $ipLimit = ['allowed' => true, 'retry_after' => 0];
    $duplicateLimit = ['allowed' => true, 'retry_after' => 0];
}

if (!$ipLimit['allowed'] || !$duplicateLimit['allowed']) {
    $retryAfter = max((int) $ipLimit['retry_after'], (int) $duplicateLimit['retry_after'], 1);
    response_json(429, ['ok' => false, 'message' => 'Слишком много попыток. Попробуйте позже.'], ['Retry-After' => (string) $retryAfter]);
}

try {
    $telegramSent = send_application_to_telegram($application);
} catch (Exception $error) {
    error_log('G10 Kirov Telegram transport is unavailable.');
    $telegramSent = false;
}

if (!$telegramSent) {
    response_json(503, ['ok' => false, 'message' => 'Не удалось принять заявку. Попробуйте ещё раз позже.']);
}

response_json(200, ['ok' => true]);
