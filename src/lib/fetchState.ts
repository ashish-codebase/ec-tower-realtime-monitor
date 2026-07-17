let fetchInProgress = false;

export function getFetchInProgress(): boolean {
  return fetchInProgress;
}

export function setFetchInProgress(value: boolean): void {
  fetchInProgress = value;
}
