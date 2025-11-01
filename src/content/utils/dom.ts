export const ensurePortalRoot = (id: string): HTMLElement => {
  const existing = document.getElementById(id);
  if (existing) {
    return existing;
  }

  const container = document.createElement('div');
  container.id = id;
  document.body.appendChild(container);
  return container;
};
