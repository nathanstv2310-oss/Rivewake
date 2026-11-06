export const ABILITIES={
  speed:{name:'Speed boost',short:'SPEED',color:'#68efba',symbol:'»',duration:20},
  spray:{name:'Spray',short:'SPRAY',color:'#ffb766',symbol:'≋',duration:20},
  jump:{name:'Jump boost',short:'JUMP',color:'#c49aff',symbol:'↑',duration:20},
  assist:{name:'Aim assist',short:'ASSIST',color:'#73d9ff',symbol:'⌖',duration:20}
};
export const PICKUP_RESPAWN=24;
export const hasAbility=(p,type)=>(p.effects?.[type]||0)>0;
