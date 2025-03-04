/* eslint-disable lines-around-comment */
import { batch } from 'react-redux';

import { createReactionSoundsDisabledEvent } from '../analytics/AnalyticsEvents';
import { sendAnalytics } from '../analytics/functions';
import { IStore } from '../app/types';
import { APP_WILL_MOUNT, APP_WILL_UNMOUNT } from '../base/app/actionTypes';
import {
    CONFERENCE_JOIN_IN_PROGRESS,
    SET_START_REACTIONS_MUTED,
    setStartReactionsMuted
    // @ts-ignore
} from '../base/conference';
import {
    getParticipantById,
    getParticipantCount,
    isLocalParticipantModerator
} from '../base/participants/functions';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';
import { SETTINGS_UPDATED } from '../base/settings/actionTypes';
// @ts-ignore
import { updateSettings } from '../base/settings/actions';
// @ts-ignore
import { playSound, registerSound, unregisterSound } from '../base/sounds';
// @ts-ignore
import { getDisabledSounds } from '../base/sounds/functions.any';
// @ts-ignore
import { NOTIFICATION_TIMEOUT_TYPE, showNotification } from '../notifications';

import {
    ADD_REACTION_BUFFER,
    FLUSH_REACTION_BUFFER,
    SEND_REACTIONS,
    PUSH_REACTIONS,
    SHOW_SOUNDS_NOTIFICATION
} from './actionTypes';
import {
    addReactionsToChat,
    flushReactionBuffer,
    pushReactions,
    sendReactions,
    setReactionQueue
} from './actions.any';
import { displayReactionSoundsNotification } from './actions.web';
import {
    ENDPOINT_REACTION_NAME,
    RAISE_HAND_SOUND_ID,
    REACTIONS,
    REACTION_SOUND,
    SOUNDS_THRESHOLDS,
    MUTE_REACTIONS_COMMAND,
    MuteCommandAttributes
} from './constants';
import {
    getReactionMessageFromBuffer,
    getReactionsSoundsThresholds,
    getReactionsWithId,
    sendReactionsWebhook
} from './functions.any';
import logger from './logger';
import { RAISE_HAND_SOUND_FILE } from './sounds';

/**
 * Middleware which intercepts Reactions actions to handle changes to the
 * visibility timeout of the Reactions.
 *
 * @param {IStore} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register((store: IStore) => (next: Function) => (action: any) => {
    const { dispatch, getState } = store;

    switch (action.type) {
    case APP_WILL_MOUNT:
        batch(() => {
            Object.keys(REACTIONS).forEach(key => {
                for (let i = 0; i < SOUNDS_THRESHOLDS.length; i++) {
                    dispatch(registerSound(
                        `${REACTIONS[key].soundId}${SOUNDS_THRESHOLDS[i]}`,
                        REACTIONS[key].soundFiles[i]
                    )
                    );
                }
            }
            );
            dispatch(registerSound(RAISE_HAND_SOUND_ID, RAISE_HAND_SOUND_FILE));
        });
        break;

    case APP_WILL_UNMOUNT:
        batch(() => {
            Object.keys(REACTIONS).forEach(key => {
                for (let i = 0; i < SOUNDS_THRESHOLDS.length; i++) {
                    dispatch(unregisterSound(`${REACTIONS[key].soundId}${SOUNDS_THRESHOLDS[i]}`));
                }
            });
            dispatch(unregisterSound(RAISE_HAND_SOUND_ID));
        });
        break;

    case ADD_REACTION_BUFFER: {
        const { timeoutID, buffer } = getState()['features/reactions'];
        const { reaction } = action;

        clearTimeout(timeoutID ?? 0);
        buffer.push(reaction);
        action.buffer = buffer;
        action.timeoutID = setTimeout(() => {
            dispatch(flushReactionBuffer());
        }, 500);

        break;
    }
    case CONFERENCE_JOIN_IN_PROGRESS: {
        const { conference } = action;

        conference.addCommandListener(
            MUTE_REACTIONS_COMMAND, ({ attributes }: { attributes: MuteCommandAttributes; }, id: any) => {
                _onMuteReactionsCommand(attributes, id, store);
            });
        break;
    }
    case FLUSH_REACTION_BUFFER: {
        const state = getState();
        const { buffer } = state['features/reactions'];
        const participantCount = getParticipantCount(state);

        batch(() => {
            if (participantCount > 1) {
                dispatch(sendReactions());
            }
            dispatch(addReactionsToChat(getReactionMessageFromBuffer(buffer)));
            dispatch(pushReactions(buffer));
        });

        sendReactionsWebhook(state, buffer);

        break;
    }

    case PUSH_REACTIONS: {
        const state = getState();
        const { queue, notificationDisplayed } = state['features/reactions'];
        const { soundsReactions } = state['features/base/settings'];
        const disabledSounds = getDisabledSounds(state);
        const reactions = action.reactions;

        batch(() => {
            if (!notificationDisplayed && soundsReactions && !disabledSounds.includes(REACTION_SOUND)
                && displayReactionSoundsNotification) {
                dispatch(displayReactionSoundsNotification());
            }
            if (soundsReactions) {
                const reactionSoundsThresholds = getReactionsSoundsThresholds(reactions);

                reactionSoundsThresholds.forEach(reaction =>
                    dispatch(playSound(`${REACTIONS[reaction.reaction].soundId}${reaction.threshold}`))
                );
            }
            dispatch(setReactionQueue([ ...queue, ...getReactionsWithId(reactions) ]));
        });
        break;
    }

    case SEND_REACTIONS: {
        const state = getState();
        const { buffer } = state['features/reactions'];
        const { conference } = state['features/base/conference'];

        if (conference) {
            conference.sendEndpointMessage('', {
                name: ENDPOINT_REACTION_NAME,
                reactions: buffer,
                timestamp: Date.now()
            });
        }
        break;
    }

    // Settings changed for mute reactions in the meeting
    case SET_START_REACTIONS_MUTED: {
        const state = getState();
        const { conference } = state['features/base/conference'];
        const { muted, updateBackend } = action;

        if (conference && isLocalParticipantModerator(state) && updateBackend) {
            conference.sendCommand(MUTE_REACTIONS_COMMAND, { attributes: { startReactionsMuted: Boolean(muted) } });
        }
        break;
    }

    case SETTINGS_UPDATED: {
        const { soundsReactions } = getState()['features/base/settings'];

        if (action.settings.soundsReactions === false && soundsReactions === true) {
            sendAnalytics(createReactionSoundsDisabledEvent());
        }
        break;
    }

    case SHOW_SOUNDS_NOTIFICATION: {
        const state = getState();
        const isModerator = isLocalParticipantModerator(state);
        const { disableReactionsModeration } = state['features/base/config'];

        const customActions = [ 'notify.reactionSounds' ];
        const customFunctions = [ () => dispatch(updateSettings({
            soundsReactions: false
        })) ];

        if (isModerator && !disableReactionsModeration) {
            customActions.push('notify.reactionSoundsForAll');
            customFunctions.push(() => batch(() => {
                dispatch(setStartReactionsMuted(true));
                dispatch(updateSettings({ soundsReactions: false }));
            }));
        }

        dispatch(showNotification({
            titleKey: 'toolbar.disableReactionSounds',
            customActionNameKey: customActions,
            customActionHandler: customFunctions
        }, NOTIFICATION_TIMEOUT_TYPE.MEDIUM));
        break;
    }
    }

    return next(action);
});

/**
 * Notifies this instance about a "Mute Reaction Sounds" command received by the Jitsi
 * conference.
 *
 * @param {Object} attributes - The attributes carried by the command.
 * @param {string} id - The identifier of the participant who issuing the
 * command. A notable idiosyncrasy to be mindful of here is that the command
 * may be issued by the local participant.
 * @param {Object} store - The redux store. Used to calculate and dispatch
 * updates.
 * @private
 * @returns {void}
 */
function _onMuteReactionsCommand(attributes: MuteCommandAttributes = {}, id: string, store: IStore) {
    const state = store.getState();

    // We require to know who issued the command because (1) only a
    // moderator is allowed to send commands and (2) a command MUST be
    // issued by a defined commander.
    if (typeof id === 'undefined') {
        return;
    }

    const participantSendingCommand = getParticipantById(state, id);

    // The Command(s) API will send us our own commands and we don't want
    // to act upon them.
    if (participantSendingCommand?.local) {
        return;
    }

    if (participantSendingCommand?.role !== 'moderator') {
        logger.warn('Received mute-reactions command not from moderator');

        return;
    }

    const oldState = Boolean(state['features/base/conference'].startReactionsMuted);

    // @ts-ignore
    const newState = attributes.startReactionsMuted === 'true';

    if (oldState !== newState) {
        batch(() => {
            store.dispatch(setStartReactionsMuted(newState));
            store.dispatch(updateSettings({ soundsReactions: !newState }));
        });
    }
}
