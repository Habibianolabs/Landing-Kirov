<?php

const MAX_REQUEST_BYTES = 16384;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 600;
const DUPLICATE_LIMIT_MAX = 2;
const DUPLICATE_LIMIT_WINDOW_SECONDS = 1800;
const MIN_FORM_TIME_SECONDS = 2;
const MAX_FORM_AGE_SECONDS = 86400;

function environment_value($name)
{
    $value = getenv($name);
    return $value === false ? '' : trim((string) $value);
}

function application_recipients()
{
    $configured = environment_value('APPLICATION_RECIPIENTS');
    if ($configured === '') {
        throw new RuntimeException('Application recipients are not configured');
    }

    $recipients = [];
    foreach (explode(',', $configured) as $recipient) {
        $recipient = trim($recipient);
        if ($recipient === '' || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('Application recipients are invalid');
        }
        $recipients[] = $recipient;
    }

    return array_values(array_unique($recipients));
}

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

    $configured = environment_value('APPLICATION_ALLOWED_ORIGINS');
    $allowedOrigins = $configured === '' ? [
        'https://g10.kirov.restoved.ru',
        'https://www.g10.kirov.restoved.ru',
    ] : array_values(array_filter(array_map('trim', explode(',', $configured))));

    if (environment_value('APPLICATION_ENV') === 'testing') {
        $allowedOrigins[] = 'http://127.0.0.1:8000';
        $allowedOrigins[] = 'http://localhost:8000';
    }

    return in_array($origin, array_unique($allowedOrigins), true);
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

function escape_html($value)
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function resend_http_status(array $headers)
{
    foreach ($headers as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d{3})\b/i', $header, $matches)) {
            return (int) $matches[1];
        }
    }
    return 0;
}

function send_resend_request(array $payload, $apiKey)
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Application email payload is invalid');
    }

    $status = 0;
    if (function_exists('curl_init')) {
        $request = curl_init('https://api.resend.com/emails');
        curl_setopt_array($request, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
                'Accept: application/json',
                'User-Agent: G10-Kirov-Application/1.0',
            ],
            CURLOPT_POSTFIELDS => $json,
        ]);
        $result = curl_exec($request);
        $status = (int) curl_getinfo($request, CURLINFO_HTTP_CODE);
        $curlError = curl_errno($request);
        curl_close($request);
        if ($result === false || $curlError !== 0) {
            throw new RuntimeException('Resend request failed');
        }
    } elseif (filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'timeout' => 20,
                'ignore_errors' => true,
                'header' => implode("\r\n", [
                    'Authorization: Bearer ' . $apiKey,
                    'Content-Type: application/json',
                    'Accept: application/json',
                    'User-Agent: G10-Kirov-Application/1.0',
                ]),
                'content' => $json,
            ],
        ]);
        $result = @file_get_contents('https://api.resend.com/emails', false, $context);
        $responseHeaders = isset($http_response_header) && is_array($http_response_header) ? $http_response_header : [];
        $status = resend_http_status($responseHeaders);
        if ($result === false && $status === 0) {
            throw new RuntimeException('Resend request failed');
        }
    } else {
        throw new RuntimeException('No HTTPS client is available');
    }

    if ($status < 200 || $status >= 300) {
        error_log('Resend rejected the G10 Kirov application email with HTTP ' . $status . '.');
        return false;
    }
    return true;
}

function send_application_email(array $application)
{
    $apiKey = environment_value('RESEND_API_KEY');
    $from = environment_value('RESEND_FROM_EMAIL');
    if ($apiKey === '' || $from === '') {
        throw new RuntimeException('Email provider is not configured');
    }

    $subject = 'Новая заявка G10 Киров — ' . $application['name'];
    $text = implode("\n", [
        'Новая заявка на участие в G10 Киров.',
        '',
        'Имя: ' . $application['name'],
        'Телефон: ' . $application['phone'],
        'E-mail: ' . $application['email'],
        'Тариф: ' . ($application['plan'] !== '' ? $application['plan'] : 'не выбран'),
        'Источник формы: ' . $application['source'],
    ]);
    $html = '<h2>Новая заявка на участие в G10 Киров</h2>'
        . '<p><strong>Имя:</strong> ' . escape_html($application['name']) . '</p>'
        . '<p><strong>Телефон:</strong> ' . escape_html($application['phone']) . '</p>'
        . '<p><strong>E-mail:</strong> ' . escape_html($application['email']) . '</p>'
        . '<p><strong>Тариф:</strong> ' . escape_html($application['plan'] !== '' ? $application['plan'] : 'не выбран') . '</p>'
        . '<p><strong>Источник формы:</strong> ' . escape_html($application['source']) . '</p>';

    return send_resend_request([
        'from' => $from,
        'to' => application_recipients(),
        'reply_to' => $application['email'],
        'subject' => $subject,
        'text' => $text,
        'html' => $html,
    ], $apiKey);
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
    $emailSent = send_application_email($application);
} catch (Exception $error) {
    error_log('G10 Kirov application email provider is unavailable.');
    $emailSent = false;
}

if (!$emailSent) {
    response_json(503, ['ok' => false, 'message' => 'Не удалось принять заявку. Попробуйте ещё раз позже.']);
}

response_json(200, ['ok' => true]);
