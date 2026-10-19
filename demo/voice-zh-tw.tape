# Run from the repository root. Recording launches VHS's browser via ttyd.
Output demo/voice-zh-tw.gif
Output demo/voice-zh-tw.mp4

Require node
Set Shell "bash"
Set Width 1320
Set Height 1000
Set FontSize 22
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms
Set Framerate 20

Hide
Type "clear"
Enter
Sleep 500ms
Show
Type "node demo/simulate.mjs"
Enter
Sleep 28s
