import React, { Component } from 'react';
import { hexValueType } from '@erebos/swarm-browser';
import {
  Container, Row, Col, Navbar, NavbarBrand, Nav, NavItem
} from 'reactstrap';
import sum from 'hash-sum';

import Account from './components/Account';
import Settings from './components/Settings';
import ContactList from './components/ContactList';
import ChatList from './components/ChatList';
import Chat from './components/Chat';
import ContactsIcon from './components/ContactsIcon';
import ChatsIcon from './components/ChatsIcon';
import storage from './base/storage';
import Messenger from './base/messenger';
import keyUtils from './base/key';
import { groupBy } from './base/fn';

import './App.css';
import logo from './logo.png';

const DEFAULT_ENDPOINT = 'ws://127.0.0.1:8546';

class App extends Component {
  messenger = undefined;

  constructor(props) {
    super(props)

    this.state = {
      account: {},
      contacts: [],
      chats: [],
      selectedChatId: {},
      selectedChat: false,
      showSettings: true,
    };

    this.onReceiveContactEvent = this.onReceiveContactEvent.bind(this);
    this.onReceiveChatEvent = this.onReceiveChatEvent.bind(this);
    this.onContactRequest = this.onContactRequest.bind(this);
    this.onAcceptContact = this.onAcceptContact.bind(this);
    this.onDeclineContact = this.onDeclineContact.bind(this);
    this.onStartChat = this.onStartChat.bind(this);
    this.onMessageSend = this.onMessageSend.bind(this);
    this.onSettingsSave = this.onSettingsSave.bind(this);
  }

  async init() {
    const appState = storage.get() || {};
    const { endpoint = DEFAULT_ENDPOINT } = appState;

    this.messenger = await new Messenger({ ws: endpoint });
    const { account } = this.messenger;
    const sessionState = appState[account.publicKey];

    this.setState({
      endpoint,
      account,
      ...sessionState,
    }, () => {
      this.messenger.subscribe({
        onReceiveContactEvent: this.onReceiveContactEvent,
        onReceiveChatEvent: this.onReceiveChatEvent,
        chats: this.state.chats
      });
    });
  }

  componentDidMount() {
    this.init();
  }

  componentWillUnmount() {
    this.messenger.unsubscribe();
  }

  async onContactRequest(value) {
    const { account, contacts } = this.state;
    keyUtils.isValidPubKey(value, account.publicKey, contacts);

    const key = hexValueType(value);
    const { sharedTopic } = await this.messenger.sendContactRequest(key);

    const list = [
      ...contacts,
      {
        key: key,
        topic: sharedTopic,
        type: 'sent_request'
      }
    ];

    this.setState({ contacts: list }, this.saveState);
    return sharedTopic;
  }

  async sendContactResponse(key, accepted) {
    await this.messenger.sendContactResponse(key, accepted);

    const { contacts, chats } = this.state;
    const existing = contacts.find(c => c.key === key);

    const contact = {
      ...existing,
      type: accepted ? 'added' : 'received_declined'
    }

    if (accepted) {
      await this.messenger.subscribeChat(contact, this.onReceiveChatEvent);
    }

    this.setState(
      {
        contacts: [...contacts.filter(c => c.key !== key), contact],
        chats: accepted ? [...chats, {
          key: contact.key,
          topic: contact.topic,
          messages: {}
        }] : chats,
      },
      this.saveState);
  }

  async onAcceptContact(key) {
    await this.sendContactResponse(key, true);
  }

  async onDeclineContact(key) {
    await this.sendContactResponse(key, false);
  }

  async onReceiveContactEvent(e) {
    const { contacts, chats } = this.state;
    const existing = contacts.find(c => c.key === e.key);

    if (
      e.type === 'contact_request' &&
      (existing == null || existing.type === 'received_request')
    ) {
      // New contact or update existing with new payload
      this.setState({
        contacts: [
          ...contacts.filter(c => c.key !== e.key),
          {
            key: e.key,
            type: 'received_request',
            topic: e.payload.topic,
            username: e.payload.username,
            address: e.payload.overlay_address,
          },
        ]
      }, this.saveState);
    } else if (
      e.type === 'contact_response' &&
      existing != null &&
      (existing.type === 'sent_declined' ||
        existing.type === 'sent_request')
    ) {
      // Response from contact, set type to 'added' or 'sent_declined' accordingly
      const contact = {
        ...existing,
        type: e.payload.contact === true ? 'added' : 'sent_declined',
        username: e.payload.username,
        address: e.payload.overlay_address,
      }

      if (e.payload.contact) {
        await this.messenger.subscribeChat(contact, this.onReceiveChatEvent);
      }

      this.setState({
        contacts: [...contacts.filter(c => c.key !== e.key), contact],
        chats: e.payload.contact ? [...chats, {
          key: contact.key,
          topic: contact.topic,
          messages: {}
        }] : chats,
      }, this.saveState);
    } else {
      console.error('unhandled event', e);
      return;
    }
  }

  onReceiveChatEvent(e) {
    const { chats } = this.state;
    const chat = chats.find(c => c.key === e.key);
    if (!chat) {
      throw new Error('Chat is not found');
    }

    chat.messages[sum(e)] = {
      sender: e.key,
      isRead: false,
      text: e.payload.text,
      timestamp: e.utc_timestamp,
    };

    this.setState({
      chats: [...chats.filter(c => c.key !== e.key), chat],
    }, this.saveState);
  }

  onStartChat(contact) {
    const { chats } = this.state;
    const chat = {
      key: contact.key,
      topic: contact.topic,
      messages: {}
    };

    const existing = chats.find(c => c.key === contact.key);
    if (existing) {
      this.setState({
        selectedChatId: contact.key,
        selectedChat: true,
        showSettings: false
      });
      return;
    }

    this.setState({
      chats: [...chats, chat],
      selectedChatId: contact.key,
      selectedChat: true,
      showSettings: false
    }, this.saveState);
  }

  async onMessageSend(key, message) {
    const { account, chats } = this.state;
    const chat = chats.find(c => c.key === key);
    if (!chat) {
      throw new Error('Chat is not found');
    }

    await this.messenger.sendChatMessage(chat.key, chat.topic, { text: message });

    const msg = {
      sender: account.publicKey,
      isRead: true,
      text: message,
      timestamp: Date.now()
    }
    chat.messages[sum(msg)] = msg;

    this.setState({
      chats: [...chats.filter(c => c.key !== key), chat],
    }, this.saveState);
  }

  onSettingsSave(endpoint, username) {
    this.setState({
      endpoint,
      account: {
        ...this.state.account,
        username
      }
    }, this.saveState);
  }

  saveState() {
    const {
      endpoint,
      account,
      contacts,
      chats } = this.state;
    const { publicKey, username } = account || {};
    if (!publicKey) {
      storage.set({ endpoint });
      return;
    }

    storage.set({
      endpoint,
      [publicKey]: {
        username,
        contacts: contacts,
        chats: chats
      }
    });
  }

  render() {
    const {
      endpoint,
      account,
      username,
      contacts,
      chats,
      selectedChat,
      selectedChatId,
      showSettings
    } = this.state;
    const requests = (groupBy(contacts, 'type')['received_request'] || []).length;
    const chat = chats.find(c => c.key === selectedChatId);
    const activeContactsStyle = !selectedChat ? { background: '#282c34' } : null;
    const activeChatsStyle = selectedChat ? { background: '#282c34' } : null;

    return (
      <Container fluid className='h-100 d-flex flex-column'>
        <Row className='flex-shrink-0 header'>
          <Navbar expand='md' className='w-100'>
            <NavbarBrand href='/'>
              <img src={logo} alt='Swarm Messenger'></img>
              <span className='pl-3 text-white'>Swarm Messenger</span>
            </NavbarBrand>
          </Navbar>
        </Row>
        <Row className='flex-grow-1'>
          <Col lg={3} md={4} style={{ borderRight: '1px solid #eee' }}>
            <Account account={account} onClick={() => this.setState({ showSettings: true })} />
            <Nav style={{ borderBottom: '3px solid #282c34' }} className='pt-4' fill>
              <NavItem
                className='p-2'
                style={activeContactsStyle}
                onClick={() => {
                  this.setState({
                    selectedChatId: undefined,
                    selectedChat: false,
                    showSettings: false
                  })
                }}>
                <ContactsIcon active={!selectedChat} requests={requests} />
              </NavItem>
              <NavItem
                className='p-2'
                style={activeChatsStyle}
                onClick={() => {
                  this.setState({
                    selectedChat: true,
                    showSettings: false
                  })
                }}>
                <ChatsIcon active={selectedChat} />
              </NavItem>
            </Nav>
            {
              selectedChat ?
                <ChatList
                  list={this.state.chats}
                  onStartChat={this.onStartChat} /> :
                <ContactList
                  list={this.state.contacts}
                  onContactRequest={this.onContactRequest}
                  onAcceptContact={this.onAcceptContact}
                  onDeclineContact={this.onDeclineContact}
                  onStartChat={this.onStartChat} />
            }
          </Col>
          <Col lg={9} md={8}>
            {
              showSettings ?
                <Settings
                  endpoint={endpoint}
                  username={username}
                  localStorage={storage.getRaw()}
                  onSave={this.onSettingsSave} /> :
                <Chat data={chat} onSend={this.onMessageSend} />
            }
          </Col>
        </Row>
      </Container>
    );
  }
}

export default App;
