import React, { useState } from 'react';
import { TableCell } from '@mui/material';
import LogContentDrawer from './LogContentDrawer';

const ContentCell = ({ content }) => {
  const [open, setOpen] = useState(false);
  const firstLine = content.split('\n')[0];

  const handleOpen = (e) => {
    e.stopPropagation();
    setOpen(true);
  };

  const handleClose = (e) => {
    if (e) e.stopPropagation();
    setOpen(false);
  };

  return (
    <TableCell onClick={handleOpen} style={{ cursor: 'pointer' }}>
      {firstLine}
      <LogContentDrawer
        open={open}
        onClose={handleClose}
        content={content}
      />
    </TableCell>
  );
};

export default ContentCell;
