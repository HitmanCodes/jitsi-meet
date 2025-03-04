/* eslint-disable lines-around-comment */
import { withStyles } from '@material-ui/styles';
import clsx from 'clsx';
import React, { Component } from 'react';
import { WithTranslation } from 'react-i18next';
import { bindActionCreators } from 'redux';

import { createReactionMenuEvent, createToolbarEvent } from '../../../analytics/AnalyticsEvents';
import { sendAnalytics } from '../../../analytics/functions';
import { IState, IStore } from '../../../app/types';
import { isMobileBrowser } from '../../../base/environment/utils';
import { translate } from '../../../base/i18n/functions';
import { raiseHand } from '../../../base/participants/actions';
import { getLocalParticipant, hasRaisedHand } from '../../../base/participants/functions';
import { connect } from '../../../base/redux/functions';
import { Theme } from '../../../base/ui/types';
import GifsMenu from '../../../gifs/components/web/GifsMenu';
// @ts-ignore
import GifsMenuButton from '../../../gifs/components/web/GifsMenuButton';
// @ts-ignore
import { isGifEnabled, isGifsMenuOpen } from '../../../gifs/functions';
// @ts-ignore
import { dockToolbox } from '../../../toolbox/actions.web';
import { addReactionToBuffer } from '../../actions.any';
import { toggleReactionsMenuVisibility } from '../../actions.web';
import { REACTIONS, REACTIONS_MENU_HEIGHT } from '../../constants';

// @ts-ignore
import ReactionButton from './ReactionButton';

interface Classes {
    overflow: string;
}

interface Props extends WithTranslation {

    /**
     * Docks the toolbox.
     */
    _dockToolbox: Function;

    /**
     * Whether or not the GIF feature is enabled.
     */
    _isGifEnabled: boolean;

    /**
     * Whether or not the GIF menu is visible.
     */
    _isGifMenuVisible: boolean;

    /**
     * Whether or not it's a mobile browser.
     */
    _isMobile: boolean;

    /**
     * The ID of the local participant.
     */
    _localParticipantID: String;

    /**
     * Whether or not the local participant's hand is raised.
     */
    _raisedHand: boolean;

    /**
     * An object containing the CSS classes.
     */
    classes: Classes;

    /**
     * The Redux Dispatch function.
     */
    dispatch: Function;

    /**
     * Whether or not it's displayed in the overflow menu.
     */
    overflowMenu: boolean;
}

const styles = (theme: Theme) => {
    return {
        overflow: {
            width: 'auto',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0), 16px)',
            backgroundColor: theme.palette.ui01,
            boxShadow: 'none',
            borderRadius: 0,
            position: 'relative',
            boxSizing: 'border-box',
            height: `${REACTIONS_MENU_HEIGHT}px`
        }
    };
};

/**
 * Implements the reactions menu.
 *
 * @returns {ReactElement}
 */
class ReactionsMenu extends Component<Props> {
    /**
     * Initializes a new {@code ReactionsMenu} instance.
     *
     * @param {Props} props - The read-only React {@code Component} props with
     * which the new instance is to be initialized.
     */
    constructor(props: Props) {
        super(props);

        this._onToolbarToggleRaiseHand = this._onToolbarToggleRaiseHand.bind(this);
        this._getReactionButtons = this._getReactionButtons.bind(this);
    }

    /**
     * Implements React Component's componentDidMount.
     *
     * @inheritdoc
     */
    componentDidMount() {
        this.props._dockToolbox(true);
    }

    /**
     * Implements React Component's componentWillUnmount.
     *
     * @inheritdoc
     */
    componentWillUnmount() {
        this.props._dockToolbox(false);
    }

    /**
     * Creates an analytics toolbar event and dispatches an action for toggling
     * raise hand.
     *
     * @returns {void}
     */
    _onToolbarToggleRaiseHand() {
        const { dispatch, _raisedHand } = this.props;

        sendAnalytics(createToolbarEvent(
            'raise.hand',
            { enable: !_raisedHand }));
        this._doToggleRaiseHand();
        dispatch(toggleReactionsMenuVisibility());
    }

    /**
     * Dispatches an action to toggle the local participant's raised hand state.
     *
     * @private
     * @returns {void}
     */
    _doToggleRaiseHand() {
        const { _raisedHand } = this.props;

        this.props.dispatch(raiseHand(!_raisedHand));
    }

    /**
     * Returns the emoji reaction buttons.
     *
     * @returns {Array}
     */
    _getReactionButtons() {
        const { t, dispatch } = this.props;
        let modifierKey = 'Alt';

        if (window.navigator?.platform) {
            if (window.navigator.platform.indexOf('Mac') !== -1) {
                modifierKey = '⌥';
            }
        }

        return Object.keys(REACTIONS).map(key => {
            /**
             * Sends reaction message.
             *
             * @returns {void}
             */
            function doSendReaction() {
                dispatch(addReactionToBuffer(key));
                sendAnalytics(createReactionMenuEvent(key));
            }

            // @ts-ignore
            return (<ReactionButton
                accessibilityLabel = { t(`toolbar.accessibilityLabel.${key}`) }
                icon = { REACTIONS[key].emoji }
                key = { key }
                // eslint-disable-next-line react/jsx-no-bind
                onClick = { doSendReaction }
                toggled = { false }
                tooltip = { `${t(`toolbar.${key}`)} (${modifierKey} + ${REACTIONS[key].shortcutChar})` } />);
        });
    }

    /**
     * Implements React's {@link Component#render}.
     *
     * @inheritdoc
     */
    render() {
        const { _raisedHand, t, overflowMenu, _isMobile, classes, _isGifMenuVisible, _isGifEnabled } = this.props;

        return (
            <div
                className = { clsx('reactions-menu', _isGifEnabled && 'with-gif',
                    overflowMenu && `overflow ${classes.overflow}`) }>
                {_isGifEnabled && _isGifMenuVisible && <GifsMenu />}
                <div className = 'reactions-row'>
                    { this._getReactionButtons() }
                    {_isGifEnabled && <GifsMenuButton />}
                </div>
                {_isMobile && (
                    <div className = 'raise-hand-row'>
                        {/* @ts-ignore */}
                        <ReactionButton
                            accessibilityLabel = { t('toolbar.accessibilityLabel.raiseHand') }
                            icon = '✋'
                            key = 'raisehand'
                            label = {
                                `${t(`toolbar.${_raisedHand ? 'lowerYourHand' : 'raiseYourHand'}`)}
                                ${overflowMenu ? '' : ' (R)'}`
                            }
                            onClick = { this._onToolbarToggleRaiseHand }
                            toggled = { true } />
                    </div>
                )}
            </div>
        );
    }
}

/**
 * Function that maps parts of Redux state tree into component props.
 *
 * @param {Object} state - Redux state.
 * @returns {Object}
 */
function mapStateToProps(state: IState) {
    const localParticipant = getLocalParticipant(state);

    return {
        _localParticipantID: localParticipant.id,
        _isMobile: isMobileBrowser(),
        _isGifEnabled: isGifEnabled(state),
        _isGifMenuVisible: isGifsMenuOpen(state),
        _raisedHand: hasRaisedHand(localParticipant)
    };
}

/**
 * Function that maps parts of Redux actions into component props.
 *
 * @param {Object} dispatch - Redux dispatch.
 * @returns {Object}
 */
function mapDispatchToProps(dispatch: IStore['dispatch']) {
    return {
        dispatch,
        ...bindActionCreators(
        {
            _dockToolbox: dockToolbox

        // @ts-ignore
        }, dispatch)
    };
}

export default translate(connect(
    mapStateToProps,
    mapDispatchToProps

    // @ts-ignore
)(withStyles(styles)(ReactionsMenu)));
