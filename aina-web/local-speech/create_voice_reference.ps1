$ainaSpeech = New-Object System.Speech.Synthesis.SpeechSynthesizer
$ainaSpeech.SelectVoice('Microsoft Zira Desktop')
$ainaSpeech.Rate = 0
$ainaSpeech.SetOutputToWaveFile((Join-Path $PSScriptRoot 'voice-reference.wav'))
$ainaSpeech.Speak('Hello! I am Aina, your friendly little virtual helper. I am happy to meet you. Let us explore something fun together today.')
$ainaSpeech.Dispose()
