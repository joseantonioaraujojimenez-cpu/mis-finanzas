// Server-only WebAuthn registration verification for recovery.
// This module does not expose HTTP routes or authorize credential replacement.
import {generateRegistrationOptions,verifyRegistrationResponse} from '@simplewebauthn/server';

export async function recoveryRegistrationOptions({rpID,rpName}) {
 return generateRegistrationOptions({
  rpID,rpName,userName:'propietario',userDisplayName:'Propietario',
  attestationType:'none',
  authenticatorSelection:{userVerification:'required',residentKey:'required'},
  excludeCredentials:[]
 });
}

export async function verifyRecoveryRegistration({response,challenge,origin,rpID}) {
 if(typeof challenge!=='string'||challenge.length<16||typeof origin!=='string'||typeof rpID!=='string')
  throw new TypeError('Invalid recovery verification parameters');
 const result=await verifyRegistrationResponse({
  response,expectedChallenge:challenge,expectedOrigin:origin,
  expectedRPID:rpID,requireUserVerification:true
 });
 if(!result.verified||!result.registrationInfo)throw new Error('Recovery registration rejected');
 const c=result.registrationInfo.credential;
 return {id:c.id,publicKey:Array.from(c.publicKey),counter:c.counter,transports:c.transports||[]};
}
