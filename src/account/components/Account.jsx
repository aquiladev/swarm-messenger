import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { withJob } from 'react-jobs';
import { Link } from 'react-router-dom';

import Identicon from './../../base/components/Identicon';
import GearIcon from './../../base/components/GearIcon';
import { fetchAccount } from './../actions';

class Account extends Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    account: PropTypes.object,
  };

  render() {
    const { account } = this.props;
    if (!account) {
      return <div>Loading</div>
    }

    const { username, publicKey } = account;
    return (
      <div class='w-100 pt-3'>
        <Link to='/settings' style={{ float: 'right', paddingTop: 8 }}>
          <GearIcon />
        </Link>
        <Link to='/profile'>
          {
            publicKey ?
              <Identicon publicKey={publicKey} size={48} style={{ float: 'left' }} /> :
              null
          }
          <div class='text-truncate font-weight-bold' style={{
            height: 48,
            lineHeight: '44px',
            paddingLeft: 10,
            paddingRight: 10
          }}>
            {username || publicKey}
          </div>
        </Link>
      </div>
    );
  }
}

export default compose(
  connect((state) => {
    const { account } = state || {
      account: {
        publicKey: '',
        username: ''
      }
    };
    return { account };
  }),
  withJob({
    work: ({ dispatch }) => dispatch(fetchAccount()),
  })
)(Account);