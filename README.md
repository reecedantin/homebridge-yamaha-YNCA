# homebridge-yamaha-YNCA

This plugin will connect to YNCA protocol compatible Yamaha receivers. ([Yamaha AV Controller App](https://usa.yamaha.com/products/audio_visual/apps/av_controller/index.html))

I made this because I wasn't happy with the current homebridge-yamaha plugin. The yamaha-nodejs library doesn't allow for continuous connection so by using this plugin you can't run scenes based on the status of your receiver.

With YNCA you can do something like:

* When you turn on the receiver, turn off the lights.
* When you change to the gaming input, make the lights green.
* Set a scene for music that automatically turns on the receiver, changes the input to Spotify/Airplay/Pandora, and sets the appropriate volume.


## Setup:
Name can be whatever you want.

Get the ip for your receiver in the Yamaha AV Controller App.

Don't change the port unless you did something different, the default YNCA port is 50000.

Just add the inputs you want to show up in the Home app in the inputs array. These have to match the default input name on the receiver, you can change the name of the input in the Home app once it is added.

## Important Info
This plugin is somewhat complete, but might not work for everyone. Connection must be maintained at all times between the receiver and homebridge. It does support multiple receivers in the devices array but this is untested. The volume shows up as a dimmer. If you turn on/off volume then it wont do anything, you need to adjust the brightness to adjust the volume.

I can't guarantee this will work forever because they can shut this down with a simple software update.
