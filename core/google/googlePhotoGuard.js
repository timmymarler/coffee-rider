let sessionFetchCount = 0;

export function canFetchGooglePhoto() {
  return sessionFetchCount < 20;
}

export function recordGooglePhotoFetch() {
  sessionFetchCount += 1;
}

export function resetGooglePhotoSession() {
  sessionFetchCount = 0;
}
