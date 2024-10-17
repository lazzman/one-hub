import React, { useState } from 'react';
import LogContentDrawer from './LogContentDrawer';
import Label from 'ui-component/Label';

const ContentCell = ({ content }) => {
  const [open, setOpen] = useState(false);
  const firstLine = content.split('\n')[0];
  const arrStr = firstLine.split('|');
  const ip = arrStr[arrStr.length - 1];

  const handleOpen = (e) => {
    e.stopPropagation();
    setOpen(true);
  };

  const handleClose = (e) => {
    if (e) e.stopPropagation();
    setOpen(false);
  };

  return (
    <Label onClick={handleOpen} scolor="info" variant="soft">
      {ip}
      <LogContentDrawer open={open} onClose={handleClose} content={content}/>
    </Label>
  );
};

export default ContentCell;
