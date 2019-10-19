import React from 'react';
import { Components, registerComponent, useSingle, useMulti, getFragment } from 'meteor/vulcan:core';
import { withStyles } from '@material-ui/core/styles';
import Messages from "../../lib/collections/messages/collection.js";
import Conversations from '../../lib/collections/conversations/collection.js';
import Card from '@material-ui/core/Card';
import withUser from '../common/withUser';

const styles = theme => ({
  root: {
    padding: theme.spacing.unit,
    width: 500,
    [theme.breakpoints.down('xs')]: {
      display: "none"
    },
  },
  title: {
    ...theme.typography.body2,
    ...theme.typography.commentStyle,
    marginBottom: theme.spacing.unit
  }
})

const ConversationPreview = ({classes, conversationId, currentUser}) => {
  const { Loading, MessageItem } = Components

  const { document: conversation, loading: conversationLoading } = useSingle({
    collection: Conversations,
    queryName: "ConversationPreview",
    fragmentName: 'conversationsListFragment',
    fetchPolicy: 'cache-then-network',
    documentId: conversationId
  });

  const { results: messages = [] } = useMulti({
    terms: {
      view: 'conversationPreview', 
      conversationId: conversationId
    },
    collection: Messages,
    queryName: 'messagesForConversation',
    fragmentName: 'messageListFragment',
    fetchPolicy: 'cache-and-network',
    limit: 10,
    ssr: true
  });
  
  if (!conversationId)

  // messages.reverse() would modifiy the original array, which causes rendering bugs 
  // Instead, create a new array using the spread operator"
  const reversedMessages = [...messages].reverse()

  return <Card className={classes.root}>
    { conversation && <div className={classes.title}>{ Conversations.getTitle(conversation, currentUser) }</div>}
    { conversationLoading && <Loading />}
    
    { reversedMessages.map((message) => (<MessageItem key={message._id} currentUser={currentUser} message={message} />))}
  </Card>
}

registerComponent('ConversationPreview', ConversationPreview, withStyles(styles, {name:"ConversationPreview"}), withUser);
