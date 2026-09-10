type FilterButton = {
  dataset: DOMStringMap;
  classList: { toggle: (token: string, force?: boolean) => boolean };
};

export function createNpcDistrictFilter(options: {
  queryButtons: () => Iterable<FilterButton>;
  onChange: (filter: string) => void;
  showToast: (message: string) => void;
}) {
  let currentFilter = 'all';

  function setFilter(filter: string) {
    currentFilter = filter;
    for (const button of options.queryButtons()) {
      button.classList.toggle('active', button.dataset.filter === filter);
    }
    options.onChange(filter);
    if (filter === 'friends') options.showToast('no friends online yet — invite someone!');
  }

  function setup(bind: (button: FilterButton, onClick: () => void) => void) {
    for (const button of options.queryButtons()) {
      bind(button, () => setFilter(button.dataset.filter ?? ''));
    }
  }

  return {
    get: () => currentFilter,
    setFilter,
    setup,
  };
}

export type NpcDistrictFilter = ReturnType<typeof createNpcDistrictFilter>;
