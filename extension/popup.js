// popup.js
const STORAGE_KEY = 'popupSelection';
const defaultSelection = { CL: false, GL: false, VS: false };

function getLocalSelection() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { ...defaultSelection };
  }

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Failed to parse stored selection', error);
    return { ...defaultSelection };
  }
}

function getStoredSelection() {
  return new Promise((resolve) => {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(STORAGE_KEY, (data) => {
        const selection = data[STORAGE_KEY] ?? getLocalSelection();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
        resolve(selection);
      });
    } else {
      resolve(getLocalSelection());
    }
  });
}

function persistSelection(selection) {
  if (chrome?.storage?.local) {
    chrome.storage.local.set({ [STORAGE_KEY]: selection });
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  if (chrome?.runtime?.sendMessage) {
    chrome.runtime.sendMessage({
      type: 'SELECTION_UPDATED',
      payload: selection,
    });
  }
}

function toSelectionMap(cl, gl, vs) {
  return { CL: cl, GL: gl, VS: vs };
}

function wireCheckbox(checkbox) {
  checkbox.addEventListener('change', () => {
    const selection = toSelectionMap(
      document.getElementById('cl-checkbox').checked,
      document.getElementById('gl-checkbox').checked,
      document.getElementById('vs-checkbox').checked
    );
    persistSelection(selection);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const clCheckbox = document.getElementById('cl-checkbox');
  const glCheckbox = document.getElementById('gl-checkbox');
  const vsCheckbox = document.getElementById('vs-checkbox');

  wireCheckbox(clCheckbox);
  wireCheckbox(glCheckbox);
  wireCheckbox(vsCheckbox);

  const storedSelection = await getStoredSelection();
  clCheckbox.checked = storedSelection.CL;
  glCheckbox.checked = storedSelection.GL;
  vsCheckbox.checked = storedSelection.VS;
});
