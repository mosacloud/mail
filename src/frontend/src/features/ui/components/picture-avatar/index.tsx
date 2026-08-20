import { UserAvatar, type AvatarProps } from "@gouvfr-lasuite/ui-kit";
import { type CSSProperties, useEffect, useState } from "react";

type PictureAvatarProps = AvatarProps & {
    /**
     * The OIDC picture URL comes from an external provider and isn't
     * guaranteed to stay reachable (expired/session-scoped URL, network
     * error). Preload it and only render it once it actually loads, so a
     * failed load falls back to ui-kit's own initials avatar instead of an
     * empty circle.
     */
    picture?: string | null;
};

/**
 * Wraps ui-kit's UserAvatar to additionally show a real picture when one is
 * available, without needing a `picture` prop on UserAvatar itself (the
 * pinned ui-kit version doesn't have one). Sets a CSS custom property scoped
 * to this instance so several different pictures can render side by side
 * (e.g. in an assignee list), unlike the single global `--user-profile-picture-url`
 * used for the current user's own avatar in the header/mailbox-selector.
 */
export const PictureAvatar = ({ picture, ...avatarProps }: PictureAvatarProps) => {
    // Tracks the last `picture` URL that successfully finished loading, so a
    // stale load from a previous `picture` value can never render — the
    // `loadedPicture === picture` check below is what invalidates it,
    // instead of clearing state synchronously from the effect body.
    const [loadedPicture, setLoadedPicture] = useState<string | null>(null);

    useEffect(() => {
        if (!picture) {
            return;
        }

        let cancelled = false;
        const image = new Image();
        image.onload = () => {
            if (!cancelled) setLoadedPicture(picture);
        };
        image.src = picture;

        return () => {
            cancelled = true;
            image.onload = null;
        };
    }, [picture]);

    if (!picture || loadedPicture !== picture) {
        return <UserAvatar {...avatarProps} />;
    }

    const escaped = picture.replace(/["\\]/g, "\\$&");

    return (
        <span
            className="picture-avatar"
            style={{ "--picture-avatar-url": `url("${escaped}")` } as CSSProperties}
        >
            <UserAvatar {...avatarProps} />
        </span>
    );
};
