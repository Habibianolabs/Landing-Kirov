<?php

// Test-only replacement for the server's sendmail program. PHP mail() passes
// the complete message here; the script stores it instead of sending it.
$captureDirectory = getenv('MAIL_CAPTURE_DIR');
if (!is_string($captureDirectory) || $captureDirectory === '') {
    fwrite(STDERR, "MAIL_CAPTURE_DIR is not configured.\n");
    exit(1);
}

if (!is_dir($captureDirectory) && !mkdir($captureDirectory, 0700, true) && !is_dir($captureDirectory)) {
    fwrite(STDERR, "Cannot create mail capture directory.\n");
    exit(1);
}

$message = file_get_contents('php://stdin');
if ($message === false || $message === '') {
    fwrite(STDERR, "No email message received.\n");
    exit(1);
}

$path = tempnam($captureDirectory, 'application-');
if ($path === false || file_put_contents($path . '.eml', $message, LOCK_EX) === false) {
    fwrite(STDERR, "Cannot store captured email.\n");
    exit(1);
}

@unlink($path);
exit(0);
