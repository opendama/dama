-- Chat/DM chrome polish: image preview glyph + more-options aria (no client hardcoding).

UPDATE platform_settings
SET value = value || '{
  "dm_image_preview_label": "Image",
  "more_options_aria": "More options",
  "chat_emoji_set": "😀😃😄😁😅😂🤣😊😇🙂😉😍🥰😘😗😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶🙄😏😣😥😮😯😪😫🥱😴😌🤤😒😓😔😕👍👎👏🙌🤝🙏💪✌️🤞🤟❤️🧡💛💚💙💜🖤🤍💔💯🔥⭐✨🎉🏆♟️🎯⚡👀💬"
}'::jsonb,
    updated_at = NOW()
WHERE key = 'play_rail_chrome';
