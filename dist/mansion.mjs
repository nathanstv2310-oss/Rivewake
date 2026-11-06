// A 128 x 104 m estate: twice Sunspoke's width and depth. All traversable
// architecture uses shared collision solids, including the open second floor.
const boxes=[],ramps=[],decor=[],signs=[];
const cream='#e8dcc0',stone='#b8b5a4',trim='#f8edcf',teal='#427c78',dark='#293e48',gold='#ddb569';
const solid=(x,y,z,w,h,d,color=cream)=>boxes.push({x,y,z,w,h,d,color});
const detail=(x,y,z,w,h,d,color=trim)=>decor.push({x,y,z,w,h,d,color});
const sign=(x,y,z,yaw,text,width=6,height=.7)=>signs.push({x,y,z,yaw,text,width,height,fg:trim,bg:dark});
for(const side of [-1,1]){
  solid(side*64.4,0,0,.8,3,104.8,stone);solid(0,0,side*52.4,128,3,.8,stone);
  // Mansion side walls: ground-floor doorways at the garden landings.
  for(const [z,d] of [[-12,8],[7,18]])solid(side*22,0,z,.6,4.3,d);
  for(const [z,d] of [[-12,8],[7,18]])solid(side*22,4.6,z,.6,3.4,d);
  solid(side*13,0,16,18,4.3,.6);solid(side*13,4.6,16,18,3.4,.6);
  solid(side*16,4.3,0,12,.3,32,stone);
  // Gallery railings leave generous entrances into the open atrium.
  solid(side*9.8,4.6,0,.25,.8,12,teal);
  for(const z of [-14,-6,2,10,16]){
    solid(side*22.4,0,z,1,8.2,1,trim);
    detail(side*22.4,8.2,z,1.35,.25,1.35,gold);
  }
  // Broad external stair-ramp gives a second route to each gallery.
  ramps.push({x:side*27,y:0,z:8,w:5,h:4.6,d:18,dir:'-z',color:stone});
  solid(side*26,4.3,-4,8,.3,6,stone);
  for(const z of [-6,10]){
    solid(side*15,0,z,7,.9,1.6,teal); // lounge cover
    solid(side*15,4.6,z,5,1.05,1.5,dark);
  }
  // Roof ribbons keep the central skylight and launch shaft open.
  solid(side*18,8,0,10,.35,33,teal);
  detail(side*22,3.95,0,.8,.25,32,gold);
  for(const z of [-12,0,12]){
    detail(side*22.32,5.6,z,.025,1.5,2.4,dark);
    detail(side*22.34,5.65,z,.03,1.4,.11,gold);
  }
}
solid(0,0,-16,44,8,.6);solid(0,4.3,-12,20,.3,8,stone);solid(0,4.3,12,20,.3,8,stone);
solid(0,8,-14,44,.35,5,teal);solid(0,8,15,44,.35,3,teal);
solid(0,2.9,16,8,1.4,.6);solid(0,7.2,16,8,.8,.6);
// Parquet, gallery runners, framed windows, and a columned entrance turn
// the shared arena shell into a house without introducing invisible cover.
detail(0,.004,0,43.5,.012,31.5,'#94765e');
for(let x=-21;x<22;x+=1.5)detail(x,.018,0,.035,.006,31.4,'#b49775');
detail(0,.025,12,6.8,.012,7,'#477c79');
for(const [x,z,w,d] of [[-16,0,11.6,31.5],[16,0,11.6,31.5],[0,-12,20,7.5],[0,12,20,7.5]]){
  detail(x,4.604,z,w,.012,d,'#aa8a68');
  detail(x,4.62,z,w-1.4,.012,d-1.4,'#bbb39b');
}
for(const x of [-17,-9,9,17])for(const y of [1.2,5.6]){
  detail(x,y-.15,16.32,3.3,2.1,.10,trim);
  detail(x,y,16.39,2.85,1.75,.04,'#365e69');
  detail(x,y,16.42,.1,1.75,.04,gold);
  detail(x,y+.85,16.42,2.85,.09,.04,gold);
}
for(const x of [-4.8,4.8]){
  solid(x,0,19,.7,3,.7,trim);detail(x,2.95,19,1,.16,1,gold);
}
solid(0,3.1,18,11,.28,4.5,teal);
for(const side of [-1,1]){
  detail(side*9.8,5.4,0,.33,.08,12,gold);
  detail(side*21.65,.25,0,.06,.08,31.2,trim);
  detail(side*21.65,3.9,0,.06,.08,31.2,trim);
}
solid(0,0,-10,6,1.1,1.5,teal);
ramps.push({x:0,y:0,z:0,w:5,h:4.6,d:16,dir:'-z',color:stone});
// Decorative stair treads follow the collision ramp.
for(let i=1;i<24;i++)detail(0,4.6*i/24-.025,8-16*i/24,4.8,.035,.12,trim);
for(const x of [-7,7])solid(x,4.6,-8,.25,.85,7,teal);
sign(0,3.65,16.34,0,'RIVET HOUSE  /  ESTATE',11,.85);
sign(0,6.3,-15.65,0,'GALLERY  /  LEVEL 02',8,.65);
sign(-6,2,-15.64,0,'SKYLIGHT LAUNCH',6,.55);
// Larger gardens contain alternating cover, fountains, and two guard houses.
detail(0,.005,31,12,.015,29,'#c6bfa7');
detail(0,.005,-32,112,.015,8,'#c6bfa7');
for(const side of [-1,1]){
  for(const z of [-40,-22,24,42]){
    solid(side*43,0,z,13,1.3,3,'#68846d');detail(side*43,1.3,z,13.1,.2,3.1,'#809b78');
    solid(side*53,0,z+5,1,5,1,'#796954');
    detail(side*53,3.5,z+5,5.3,3.4,5.1,'#719782');
  }
  solid(side*42,0,0,12,3.3,13,teal);
  ramps.push({x:side*42,y:0,z:13,w:5,h:3.3,d:13,dir:'-z',color:stone});
  solid(side*42,3.3,-3,6,1.1,2,dark);
  solid(side*18,0,33,9,.55,8,stone);
  solid(side*18,.55,33,3,1.2,3,teal);
  detail(side*18,1.75,33,4,.15,4,gold);
  sign(side*42,2,6.54,0,side<0?'WEST LODGE':'EAST LODGE',7,.65);
  for(const x of [34,56])solid(side*x,0,-43,5,1.6,4,dark);
}
export const MANSION={name:'Rivet House Estate',bounds:{minX:-64,maxX:64,minZ:-52,maxZ:52},floorColor:'#8caa8a',boxes,ramps,decor,signs,
  preview:{eye:[47,23,49],target:[0,3,0]},
  pads:[{x:-6,y:0,z:0},{x:6,y:0,z:0},{x:-35,y:0,z:0},{x:35,y:0,z:0}],
  pickupSites:[{x:-16,y:0,z:0},{x:16,y:0,z:0},{x:-16,y:4.6,z:-11},{x:16,y:4.6,z:7},{x:0,y:0,z:30},{x:0,y:0,z:-32},{x:-52,y:0,z:12},{x:52,y:0,z:12}]
};
