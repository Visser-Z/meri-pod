export function generatePodId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `POD-${num}`;
}
