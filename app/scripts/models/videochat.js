/*
 * Q-municate chat application
 *
 * VideoChat Module
 *
 */

define(['jquery', 'config', 'quickblox'], function($, QMCONFIG, QB) {

  var self;
  
  function VideoChat(app) {
    this.app = app;
    self = this;
  }

  VideoChat.prototype.getUserMedia = function(options, className, callback) {
    var User = this.app.models.User;
    var callType = (typeof className === 'string' && !!className.match(/videoCall/)) || (className === 1) ? 'video' : 'audio';
    var params = {
      audio: true,
      video: callType === 'video' ? true : false,
      elemId: 'localStream',
      options: {
        muted: true,
        mirror: true
      }
    };

    QB.webrtc.getUserMedia(params, function(err, stream) {
      if (err) {
        console.log(err);
        if (!options.isCallee) {
          callback(err, null);
        } else {
          self.sendMessage(options.opponentId, '4', null, options.dialogId, callType, true);
          callback(err, null);
        }
      } else {
        console.log(stream);

        if (!$('.l-chat[data-dialog="'+options.dialogId+'"]').find('.mediacall')[0]) {
          stream.stop();
          return true;
        }

        if (options.isCallee) {
          QB.webrtc.createPeer({
            sessionID: options.sessionId,
            description: options.sdp
          });
          QB.webrtc.accept(options.opponentId, {
            dialog_id: options.dialogId
          });
          self.caller = options.opponentId;
          self.callee = User.contact.id;
        } else {
          QB.webrtc.createPeer();
          QB.webrtc.call(options.opponentId, callType, {
            dialog_id: options.dialogId,
            avatar: User.contact.avatar_url,
            full_name: User.contact.full_name
          });
          self.caller = User.contact.id;
          self.callee = options.opponentId;
        }
        callback(null, stream);
      }
    });
  };

  VideoChat.prototype.sendMessage = function(userId, state, duration, dialogId, callType, isErrorMessage, sessionID) {
    var jid = QB.chat.helpers.getUserJid(userId, QMCONFIG.qbAccount.appId),
        User = this.app.models.User,
        Message = this.app.models.Message,
        MessageView = this.app.views.Message,
        VideoChatView = this.app.views.VideoChat,
        time = Math.floor(Date.now() / 1000),
        dialogItem = $('.l-list-wrap section:not(#searchList) .dialog-item[data-dialog="'+dialogId+'"]'),
        copyDialogItem,
        message;

    if (!isErrorMessage) {
      var extension = {
        save_to_history: 1,
        date_sent: time,

        callType: state === '3' ? callType : VideoChatView.type === 'video' ? '1' : '2',
        callState: state === '1' && !duration ? '2' : state,
        caller: state === '3' ? userId : self.caller,
        callee: state === '3' ? User.contact.id : self.callee
      };

      if (duration) extension.duration = duration;
    } else {
      var extension = {
        save_to_history: 1,
        date_sent: time,

        callType: callType === 'video' ? '1' : '2',
        callState: state,
        caller: userId,
        callee: User.contact.id
      };
    }

    if (sessionID) extension.sessionID = sessionID;

    QB.chat.send(jid, {
      type: 'chat',
      body: 'Call info',
      extension: extension
    });

    message = Message.create({
      chat_dialog_id: dialogId,
      date_sent: time,
      sender_id: User.contact.id,
      callType: extension.callType,
      callState: extension.callState,
      caller: extension.caller,
      callee: extension.callee,
      duration: extension.duration || null,
      sessionID: extension.sessionID || null
    });
    if (QMCONFIG.debug) console.log(message);
    MessageView.addItem(message, true, true);

    if (dialogItem.length > 0) {
      copyDialogItem = dialogItem.clone();
      dialogItem.remove();
      $('#recentList ul').prepend(copyDialogItem);
      if (!$('#searchList').is(':visible')) {
       $('#recentList').removeClass('is-hidden');
       isSectionEmpty($('#recentList ul')); 
      }
    }
  };

  /* Private
  ---------------------------------------------------------------------- */
  function isSectionEmpty(list) {
    if (list.contents().length === 0)
      list.parent().addClass('is-hidden');

    if ($('#historyList ul').contents().length === 0)
        $('#historyList ul').parent().addClass('is-hidden');

    if ($('#requestsList').is('.is-hidden') &&
        $('#recentList').is('.is-hidden') &&
        $('#historyList').is('.is-hidden')) {
      
      $('#emptyList').removeClass('is-hidden');
    }
  }

  return VideoChat;

});
