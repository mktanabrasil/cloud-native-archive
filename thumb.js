const {loadImage,createCanvas}=require('@napi-rs/canvas');const fs=require('fs');
(async()=>{for(const [i,o,w] of JSON.parse(process.argv[2])){const im=await loadImage(fs.readFileSync(i));const h=Math.round(im.height*w/im.width);const c=createCanvas(w,h);c.getContext('2d').drawImage(im,0,0,w,h);fs.writeFileSync(o,c.toBuffer('image/jpeg',85));}})();
