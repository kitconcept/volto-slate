import React from 'react';
// import cx from 'classnames';

import ToolbarButton from './ToolbarButton';
import BasicToolbar from './BasicToolbar';
import Expando from './Expando';

import toggleIcon from '@plone/volto/icons/freedom.svg';

const ExpandedToolbar = React.forwardRef(
  ({ className, onToggle, mainToolbarShown, children, ...props }, ref) => {
    return (
      <BasicToolbar {...props} className={className} ref={ref}>
        {children}
        <Expando />
        <ToolbarButton
          onMouseDown={(event) => {
            onToggle();
            event.preventDefault();
          }}
          icon={toggleIcon}
          active={mainToolbarShown}
        />
      </BasicToolbar>
    );
  },
);

export default ExpandedToolbar;