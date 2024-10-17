import React from 'react';
import PropTypes from 'prop-types';
import { Stack } from '@mui/material';

export const handleContentCellOpen = (event, onOpen, content) => {
  if (event?.stopPropagation) {
    event.stopPropagation();
  }

  if (typeof onOpen === 'function') {
    onOpen(content);
  }
};

const ContentCell = ({ content, children, onOpen }) => {
  return (
    <Stack onClick={(event) => handleContentCellOpen(event, onOpen, content)} direction="column" spacing={0.3}>
      {children}
    </Stack>
  );
};

ContentCell.propTypes = {
  content: PropTypes.any,
  children: PropTypes.node,
  onOpen: PropTypes.func
};

export default ContentCell;
