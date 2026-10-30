/* Plan y temporizador de decoración. No usa imágenes de productos ni pedidos. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MomotusSeasonEffectsCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function plan(season,compact=false){return season==='aguizotes'?{season,bats:compact?4:6,snow:0,cadejo:true,whiteCadejo:true,chicoLargo:true}:season==='navidad'?{season,bats:0,snow:compact?12:20,cadejo:false,whiteCadejo:false,chicoLargo:false}:null;}
const timing=Object.freeze({firstDelay:600,repeatMin:12000,repeatMax:16000,batDuration:13000,batStep:500,dogDuration:10500,chicoDuration:11200});
function appearance(index){const i=Math.max(0,Math.trunc(Number(index)||0));return {cadejo:i%3===2?'black':'white',chicoLargo:i%2===0};}
function createClock({setTimer=setTimeout,clearTimer=clearTimeout,random=Math.random,show=()=>{}}={}){
 let timer=null,running=false,shown=false,epoch=0,appearanceIndex=0;
 const later=()=>{const value=Number(random());return timing.repeatMin+Math.min(1,Math.max(0,Number.isFinite(value)?value:0))*(timing.repeatMax-timing.repeatMin);};
 function schedule(delay){const token=epoch;timer=setTimer(()=>{if(!running||epoch!==token)return;timer=null;shown=true;show(appearance(appearanceIndex++));if(running&&epoch===token)schedule(later());},delay);}
 function start(){if(running)return;running=true;schedule(shown?later():timing.firstDelay);}
 function stop(){running=false;epoch++;if(timer!==null){clearTimer(timer);timer=null;}}
 function reset(){stop();shown=false;appearanceIndex=0;}
 return Object.freeze({start,stop,reset});
}
return Object.freeze({plan,appearance,timing,createClock});
});
