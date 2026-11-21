// Internal orchestration only. Not imported by public HTTP routes.
// Never accept a client-provided "verified" flag or credential object.
import {recoveryRegistrationOptions,verifyRecoveryRegistration} from './recovery-webauthn.js';

export async function beginRecoveryRegistration({ticket,coordinator,rpID,rpName}) {
 if(typeof ticket!=='string'||!ticket)throw new TypeError('Recovery ticket required');
 const options=await recoveryRegistrationOptions({rpID,rpName});
 const {created}=await coordinator('/recovery/challenge/create',{ticket,challenge:options.challenge});
 if(!created)throw new Error('Recovery authorization expired');
 return options;
}

export async function completeRecoveryRegistration({ticket,response,coordinator,origin,rpID}) {
 if(typeof ticket!=='string'||!ticket)throw new TypeError('Recovery ticket required');
 const {challenge}=await coordinator('/recovery/challenge/consume',{ticket});
 if(!challenge)throw new Error('Recovery challenge expired or already used');
 // A failed attestation leaves the recovery code intact; a fresh challenge is needed.
 const credential=await verifyRecoveryRegistration({response,challenge,origin,rpID});
 const {replaced}=await coordinator('/recovery/finalize',{ticket,credential});
 if(!replaced)throw new Error('Recovery authorization expired or already used');
 return {recovered:true};
}
