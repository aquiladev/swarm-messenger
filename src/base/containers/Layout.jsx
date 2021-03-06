import React from 'react';
import PropTypes from 'prop-types';
import withStyles from '@material-ui/core/styles/withStyles';
import CssBaseline from '@material-ui/core/CssBaseline';

import Header from './../components/Header';
import Error from './../error/components/Error';
import ConnectionController from './ConnectionController';

const styles = _ => ({
  layout: {
    height: '100%',
    paddingTop: 64
  }
});

function Layout({ classes, children, isNarrow }) {
  return (
    <ConnectionController>
      <CssBaseline />
      <Header isNarrow={isNarrow} />
      <main className={classes.layout}>
        {children}
      </main>
      <Error />
    </ConnectionController>
  );
}

Layout.propTypes = {
  classes: PropTypes.object.isRequired,
  children: PropTypes.node,
  isNarrow: PropTypes.bool
};

export default withStyles(styles)(Layout);