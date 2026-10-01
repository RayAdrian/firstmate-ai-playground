# Shared look for every recording (PRD 15 MD-5): fixed size, font, typing speed and a theme
# built from docs/design/tokens.css (the dark CodeBlock palette: --fm-code-bg #0f1729,
# --fm-code-fg #e6edf3, --fm-code-muted #9aa4b2, --fm-code-focus #9fa5ff). No accent-2 for
# text, so the red and yellow slots are soft tints.
#
# Rules for every tape:
# - Legibility: the video plays about 328px wide on a phone, so text is 32px in the 1280px
#   frame (about 9px on screen) and a line holds about 62 columns. Typed commands must not wrap.
# - Safe area: keep terminal output in roughly the top 65% of the frame (about 10 rows at this
#   size). The lower part sits under the caption and the native control bar. Trim long output
#   with head/sed and clear the screen between steps.
# - Never use a fixed Sleep to wait for a command. After Enter use `Wait /^\$\s*$/` (the prompt
#   is back), then a Sleep only as a reading hold. This keeps the golden identical across runs.
Set Shell "bash"
Set Width 1280
Set Height 720
Set FontFamily "Menlo"
Set FontSize 32
Set LineHeight 1.3
Set Padding 28
Set TypingSpeed 55ms
Set CursorBlink false
Set Framerate 24
Set PlaybackSpeed 1
Set Theme { "name": "First Mate", "background": "#0f1729", "foreground": "#e6edf3", "cursor": "#9fa5ff", "selection": "#16203a", "black": "#16203a", "red": "#ff9b7a", "green": "#7ee2a8", "yellow": "#f2cf86", "blue": "#9fa5ff", "magenta": "#c9b3ff", "cyan": "#86d9ee", "white": "#e6edf3", "brightBlack": "#9aa4b2", "brightRed": "#ffb59a", "brightGreen": "#a2efc4", "brightYellow": "#f7dda4", "brightBlue": "#b9beff", "brightMagenta": "#dccdff", "brightCyan": "#a8e6f5", "brightWhite": "#ffffff" }
