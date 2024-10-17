export const createInitialLogDrawerState = () => ({
  mounted: false,
  open: false,
  content: null,
  version: 0
});

export const openLogDrawerState = (previousState, content) => ({
  mounted: true,
  open: true,
  content: content ?? '',
  version: (previousState?.version ?? 0) + 1
});

export const closeLogDrawerState = (previousState) => {
  if (!previousState?.mounted) {
    return previousState ?? createInitialLogDrawerState();
  }

  return {
    ...previousState,
    open: false
  };
};

export const unmountLogDrawerState = (previousState) => {
  if (!previousState) {
    return createInitialLogDrawerState();
  }

  return {
    ...previousState,
    mounted: false,
    open: false,
    content: null
  };
};
