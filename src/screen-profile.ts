// Economic video profile. Browser controls are not a provider/account quota.
export const economicScreen={width:1280,height:720,fps:5,bitrate:256000,durationSeconds:300} as const
export function screenCaptureSettings(track:MediaStreamTrack){
 const {width,height,frameRate}=track.getSettings()
 if(!width||!height||!frameRate||width>economicScreen.width||height>economicScreen.height||frameRate>economicScreen.fps+.01)throw Error('screen-profile')
 return {width,height,fps:frameRate}
}
export async function constrainScreen(track:MediaStreamTrack){
 track.contentHint='detail'
 await track.applyConstraints({width:{max:economicScreen.width},height:{max:economicScreen.height},frameRate:{max:economicScreen.fps}})
 return screenCaptureSettings(track)
}
export function screenSenderSettings(sender:RTCRtpSender){
 const encodings=sender.getParameters().encodings
 if(!encodings?.length||encodings.some(e=>!e.maxBitrate||e.maxBitrate>economicScreen.bitrate||!e.maxFramerate||e.maxFramerate>economicScreen.fps))throw Error('screen-profile')
 return {bitrate:Math.max(...encodings.map(e=>e.maxBitrate!)),fps:Math.max(...encodings.map(e=>e.maxFramerate!))}
}
export async function constrainScreenSender(sender:RTCRtpSender){
 const parameters=sender.getParameters()
 if(!parameters.encodings?.length)throw Error('screen-profile')
 for(const encoding of parameters.encodings){encoding.maxBitrate=economicScreen.bitrate;encoding.maxFramerate=economicScreen.fps}
 parameters.degradationPreference='maintain-resolution'
 await sender.setParameters(parameters)
 return screenSenderSettings(sender)
}
