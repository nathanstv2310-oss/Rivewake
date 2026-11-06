// Exact critically damped springs stay stable across different frame rates.
export function spring(state,key,target,speed,dt){
  const velocityKey=key+'Velocity',value=state[key]??target,velocity=state[velocityKey]||0;
  const offset=value-target,impulse=velocity+speed*offset,decay=Math.exp(-speed*dt);
  state[key]=target+(offset+impulse*dt)*decay;
  state[velocityKey]=(velocity-speed*impulse*dt)*decay;
  return state[key];
}
const ease=t=>t*t*(3-2*t);
export function weaponTransition(state,slot,dt){
  if(state.displaySlot===undefined){state.displaySlot=slot;state.targetSlot=slot;state.swapTime=1;}
  if(slot!==state.targetSlot){state.targetSlot=slot;state.swapTime=0;}
  state.swapTime+=dt;
  if(state.swapTime>=.15)state.displaySlot=state.targetSlot;
  return state.swapTime<.15?ease(state.swapTime/.15):1-ease(Math.min(1,(state.swapTime-.15)/.2));
}
