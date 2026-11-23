import test from 'node:test'
import assert from 'node:assert/strict'
import {constrainScreen,constrainScreenSender,screenCaptureSettings,screenSenderSettings} from '../src/screen-profile.ts'

test('Perfil econômico recusa controles ausentes, recusados ou acima do limite',async()=>{
 for(const settings of [{},{width:1920,height:1080,frameRate:5},{width:1280,height:720,frameRate:30}])assert.throws(()=>screenCaptureSettings({getSettings:()=>settings}))
 await assert.rejects(constrainScreen({applyConstraints:async()=>{throw Error('refused')}}))
 for(const encodings of [[],[{}],[{maxBitrate:900000,maxFramerate:5}],[{maxBitrate:256000,maxFramerate:15}]])assert.throws(()=>screenSenderSettings({getParameters:()=>({encodings})}))
 await assert.rejects(constrainScreenSender({getParameters:()=>({encodings:[{}]}),setParameters:async()=>{throw Error('refused')}}))
 const ignored={getParameters:()=>({encodings:[{}]}),setParameters:async()=>{}}
 await assert.rejects(constrainScreenSender(ignored))
})
