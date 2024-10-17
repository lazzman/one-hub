import React, { useState } from 'react';
import LogContentDrawer from './LogContentDrawer/index';
import { Stack } from '@mui/material';

const ContentCell = ({ content, children }) => {
  const [open, setOpen] = useState(false);
  // const firstLine = content.split('\n')[0];
  // const arrStr = firstLine.split('|');
  // const ip = arrStr[arrStr.length - 1];

  const handleOpen = (e) => {
    e.stopPropagation();
    setOpen(true);
  };

  const handleClose = (e) => {
    if (e) e.stopPropagation();
    setOpen(false);
  };

  return (
    <Stack onClick={handleOpen} direction="column" spacing={0.3}>
      {children}
      {/*<Label onClick={handleOpen} color="info" variant="soft">*/}
      {/*  {ip}*/}
      {/*</Label>*/}
      <LogContentDrawer open={open} onClose={handleClose} content={content}/>
    </Stack>
  );
};

export default ContentCell;
