import { makeStyles } from '@material-ui/core';
import React from 'react';
import { WithTranslation } from 'react-i18next';

import { translate } from '../../../i18n/functions';
import Icon from '../../../icons/components/Icon';
// eslint-disable-next-line lines-around-comment
// @ts-ignore
import { Tooltip } from '../../../tooltip';

/**
 * The type of the React {@code Component} props of {@link BaseIndicator}.
 */
interface Props extends WithTranslation {

    /**
     * Additional CSS class name.
     */
    className?: string;

    /**
     * The icon component to use.
     */
    icon: Function;

    /**
     * The CSS classnames to set on the icon element of the component.
    */
    iconClassName?: string;

    /**
     * The color of the icon.
     */
    iconColor?: string;

    /**
     * Id of the icon to be rendered.
     */
    iconId?: string;

    /**
     * The font size for the icon.
     */
    iconSize: string;

    /**
     * The ID attribute to set on the root element of the component.
     */
    id?: string;

    /**
     * The translation key to use for displaying a tooltip when hovering over
     * the component.
     */
    tooltipKey: string;

    /**
     * From which side of the indicator the tooltip should appear from,
     * defaulting to "top".
     */
    tooltipPosition: string;
}

const useStyles = makeStyles(() => {
    return {
        indicator: {
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }
    };
});

/**
 * React {@code Component} for showing an icon with a tooltip.
 *
 * @returns {ReactElement}
 */
const BaseIndicator = ({
    className = '',
    icon,
    iconClassName,
    iconColor,
    iconId,
    iconSize,
    id = '',
    t,
    tooltipKey,
    tooltipPosition = 'top'
}: Props) => {
    const styles = useStyles();
    const style: any = {};

    if (iconSize) {
        style.fontSize = iconSize;
    }

    return (
        <div className = { styles.indicator }>
            <Tooltip
                content = { t(tooltipKey) }
                position = { tooltipPosition }>
                <span
                    className = { className }
                    id = { id }>
                    <Icon
                        className = { iconClassName }
                        color = { iconColor }
                        id = { iconId }
                        src = { icon }
                        style = { style } />
                </span>
            </Tooltip>
        </div>
    );
};

export default translate(BaseIndicator);
