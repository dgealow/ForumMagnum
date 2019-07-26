import { Components, registerComponent } from 'meteor/vulcan:core';
import { withRouter } from '../../lib/reactRouterWrapper.js';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { withStyles } from '@material-ui/core/styles';
import withErrorBoundary from '../common/withErrorBoundary';
import withUser from '../common/withUser';
import { shallowEqual, shallowEqualExcept } from '../../lib/modules/utils/componentUtils';

const KARMA_COLLAPSE_THRESHOLD = -4;

const styles = theme => ({
  node: {
    cursor: "default",
    // Higher specificity to override child class (variant syntax)
    '&$new': {
      borderLeft: `solid 5px ${theme.palette.secondary.light}`,
      
      '&:hover': {
        borderLeft: `solid 5px ${theme.palette.secondary.main}`
      },
    },
    '&$deleted': {
      opacity: 0.6
    }
  },
  child: {
    marginLeft: theme.spacing.unit,
    marginBottom: theme.spacing.unit,
    borderLeft: `solid 1px ${theme.palette.grey[300]}`,
    borderTop: `solid 1px ${theme.palette.grey[300]}`,
    borderBottom: `solid 1px ${theme.palette.grey[300]}`,
  },
  new: {},
  deleted: {},
  parentScroll: {
    position: "absolute",
    top:0,
    left:0,
    width:8,
    height:"100%",
    cursor:"pointer",
    '&:hover': {
      backgroundColor: "rgba(0,0,0,.075)"
    }
  },
  isAnswer: {
    border: `solid 2px ${theme.palette.grey[300]}`,
  },
  answerChildComment: {
    marginBottom: theme.spacing.unit,
    border: `solid 1px ${theme.palette.grey[300]}`,
  },
  childAnswerComment: {
    borderRight: "none"
  },
  oddAnswerComment: {
    backgroundColor: 'white'
  },
  answerLeafComment: {
    paddingBottom: 0
  },
  isSingleLine: {
    marginBottom: 0,
    borderBottom: "none",
    borderTop: "solid 1px rgba(0,0,0,.15)",
    '&.comments-node-root':{
      marginBottom: 6,
      borderBottom: "solid 1px rgba(0,0,0,.2)",
    }
  },
  commentHidden: {
    border: "none !important",
    background: "none"
  },
  shortformTop: {
    '&&': {
      marginTop: theme.spacing.unit*4,
      marginBottom: 0
    }
  },
  children: {
    position: "relative"
  },
})

class CommentsNode extends Component {
  constructor(props) {
    super(props);

    this.state = {
      collapsed: this.beginCollapsed(),
      truncated: this.beginTruncated(),
      singleLine: this.beginSingleLine(),
      truncatedStateSet: false,
      finishedScroll: false,
    };
    this.scrollTargetRef = React.createRef();
  }

  beginCollapsed = () => {
    const { comment } = this.props
    return (
      comment.deleted ||
      comment.baseScore < KARMA_COLLAPSE_THRESHOLD
    )
  }

  beginTruncated = () => {
    return this.props.startThreadTruncated
  }
  
  beginSingleLine = () => {
    const { currentUser, comment, condensed, lastCommentId, forceSingleLine, shortform, nestingLevel, postPage } = this.props
    const mostRecent = lastCommentId === comment._id
    const lowKarmaOrCondensed = (comment.baseScore < 10 || condensed)
    const shortformAndTop = (nestingLevel === 1) && shortform
    const postPageAndTop = (nestingLevel === 1) && postPage
    
    if (forceSingleLine)
      return true;
    
    return (
      this.isTruncated() &&
      currentUser?.beta &&
      lowKarmaOrCondensed &&
      !(mostRecent && condensed) &&
      !(shortformAndTop) && 
      !(postPageAndTop)
    )
  }

  componentDidMount() {
    const { router, comment, post } = this.props
    let commentHash = router.location.hash;
    const self = this;
    if (comment && commentHash === ("#" + comment._id) && post) {
      setTimeout(function () { //setTimeout make sure we execute this after the element has properly rendered
        self.scrollIntoView()
      }, 0);
    }
  }

  scrollIntoView = (event) => {
    this.scrollTargetRef.current?.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
    this.setState({finishedScroll: true});
  }

  toggleCollapse = () => {
    this.setState({collapsed: !this.state.collapsed});
  }

  unTruncate = (event) => {
    event.stopPropagation()
    if (this.isTruncated() || this.isSingleLine()) {
      this.props.markAsRead && this.props.markAsRead()
      this.setState({truncated: false, singleLine: false, truncatedStateSet: true});
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (!shallowEqual(this.state, nextState))
      return true;
    if (!shallowEqualExcept(this.props, nextProps, ["editMutation", "post", "children"]))
      return true;
    if (this.commentTreesDiffer(this.props.children, nextProps.children))
      return true;

    return false;
  }

  commentTreesDiffer(oldComments, newComments) {
    if(!oldComments && newComments) return true;
    if(oldComments && !newComments) return true;
    if(!newComments) return false;

    if(oldComments.length != newComments.length)
      return true;
    for(let i=0; i<oldComments.length; i++) {
      if(oldComments[i].item != newComments[i].item)
        return true;
      if(this.commentTreesDiffer(oldComments[i].children, newComments[i].children))
        return true;
    }
    return false;
  }

  isTruncated = () => {
    const { expandAllThreads, startThreadTruncated } = this.props;
    // const { truncatedStateSet } = this.state

    const truncatedStateUnset = !this.state || !this.state.truncatedStateSet
    
    return !expandAllThreads && (this.state?.truncated || ((this.props.truncated && truncatedStateUnset) || (startThreadTruncated && truncatedStateUnset)))
  }

  isNewComment = () => {
    const { comment, highlightDate } = this.props;
    return !!(highlightDate && (new Date(comment.postedAt).getTime() > new Date(highlightDate).getTime()))
  }

  isSingleLine = () => {
    const { forceSingleLine } = this.props
    const { singleLine } = this.state
    if (!singleLine) return false;
    if (forceSingleLine)
      return true;

    return this.isTruncated() && !this.isNewComment();
  }

  render() {
    const { comment, children, nestingLevel=1, highlightDate, editMutation, post,
      muiTheme, router, postPage, classes, child, showPostTitle, unreadComments,
      parentAnswerId, condensed, markAsRead, lastCommentId, hideReadComments,
      loadChildrenSeparately, shortform, refetch } = this.props;

    const { SingleLineComment, CommentsItem, RepliesToCommentList } = Components

    if (!comment || !post)
      return null;

    const { collapsed, finishedScroll } = this.state

    const newComment = this.isNewComment()

    const hiddenReadComment = hideReadComments && !newComment

    const nodeClass = classNames(
      "comments-node",
      classes.node,
      {
        "af":comment.af,
        "comments-node-root" : nestingLevel === 1,
        "comments-node-even" : nestingLevel % 2 === 0,
        "comments-node-odd"  : nestingLevel % 2 !== 0,
        "comments-node-linked" : router.location.hash === "#" + comment._id && finishedScroll,
        "comments-node-its-getting-nested-here": nestingLevel > 8,
        "comments-node-so-take-off-all-your-margins": nestingLevel > 12,
        "comments-node-im-getting-so-nested": nestingLevel > 16,
        "comments-node-im-gonna-drop-my-margins": nestingLevel > 20,
        "comments-node-what-are-you-even-arguing-about": nestingLevel > 24,
        "comments-node-are-you-sure-this-is-a-good-idea": nestingLevel > 28,
        "comments-node-seriously-what-the-fuck": nestingLevel > 32,
        "comments-node-are-you-curi-and-lumifer-specifically": nestingLevel > 36,
        "comments-node-cuz-i-guess-that-makes-sense-but-like-really-tho": nestingLevel > 40,
        [classes.child]: child && (!hideReadComments || comment.children?.length),
        [classes.new]: newComment,
        [classes.deleted]: comment.deleted,
        [classes.isAnswer]: comment.answer,
        [classes.answerChildComment]: parentAnswerId,
        [classes.childAnswerComment]: child && parentAnswerId,
        [classes.oddAnswerComment]: (nestingLevel % 2 !== 0) && parentAnswerId,
        [classes.answerLeafComment]: !(children && children.length),
        [classes.isSingleLine]: this.isSingleLine(),
        [classes.commentHidden]: hiddenReadComment,
        [classes.shortformTop]: shortform && (nestingLevel===1)
      }
    )

    const passedThroughItemProps = { post, postPage, comment, editMutation, nestingLevel, showPostTitle, collapsed, refetch }
    const passedThroughNodeProps = { post, postPage, unreadComments, lastCommentId, markAsRead, muiTheme, highlightDate, editMutation, condensed, hideReadComments, refetch }

    return (
        <div className={nodeClass}
          onClick={(event) => this.unTruncate(event)}
          id={comment._id}
         >
          {!hiddenReadComment && <div ref={this.scrollTargetRef}>
            {this.isSingleLine()
              ? <SingleLineComment comment={comment} nestingLevel={nestingLevel} />
              : <CommentsItem
                  truncated={this.isTruncated()}
                  parentAnswerId={parentAnswerId || (comment.answer && comment._id)}
                  toggleCollapse={this.toggleCollapse}
                  key={comment._id}
                  scrollIntoView={this.scrollIntoView}
                  { ...passedThroughItemProps}
                />
            }
          </div>}
          
          {!collapsed && children && children.length>0 && <div className={classes.children}>
            <div className={classes.parentScroll} onClick={this.scrollIntoView}/>
            {children && children.map(child =>
              <Components.CommentsNode child
                comment={child.item}
                parentAnswerId={parentAnswerId || (comment.answer && comment._id)}
                nestingLevel={nestingLevel+1}
                truncated={this.isTruncated()}
                //eslint-disable-next-line react/no-children-prop
                children={child.children}
                key={child.item._id}
                
                { ...passedThroughNodeProps}
              />)}
          </div>}
          
          {!this.isSingleLine() && loadChildrenSeparately &&
            <div className="comments-children">
              <div className={classes.parentScroll} onClick={this.scrollIntoView}/>
              <RepliesToCommentList
                terms={{
                  view: "repliesToCommentThread",
                  topLevelCommentId: comment._id
                }}
                post={post}
              />
            </div>
          }
        </div>
    )
  }
}

CommentsNode.propTypes = {
  comment: PropTypes.object.isRequired, // the current comment
  router: PropTypes.object.isRequired
};

registerComponent('CommentsNode', CommentsNode,
  withUser, 
  withRouter,
  withErrorBoundary,
  withStyles(styles, { name: "CommentsNode" })
);
