import type {FlowEdge,FlowNode,Workflow} from '../types';

/** 受控子流程引用配置：插入时锁定一个已发布版本 */
export interface SubflowRefConfig {
  sourceId:string;
  sourceName:string;
  /** 插入时锁定的已发布版本 */
  pinnedVersion:number;
  /** 插入时的版本；升级只改变 pinnedVersion，存量实例继续按它运行 */
  insertedVersion:number;
  /** 插入后产生的运行实例，继续按 insertedVersion 运行 */
  runningInstances:number;
  /** 最近一次升级检查结果；无结果时仅显示“可升级”入口 */
  check?:{
    targetVersion:number;
    status:'ready'|'blocked';
    gaps:string[];
    checkedAt:string;
  };
}

export const isSubflowNode=(n:FlowNode)=>n.type==='subflow';

export const getRef=(n:FlowNode):SubflowRefConfig|undefined=>
  n.type==='subflow'?(n.data.config as SubflowRefConfig):undefined;

export interface RefView {
  node:FlowNode;
  ref:SubflowRefConfig;
  source?:Workflow;
  sourceArchived:boolean;
  latestVersion:number|null;
  /** up-to-date 当前版本即最新；upgradable 源有新版；archived-source 源已归档 */
  state:'up-to-date'|'upgradable'|'archived-source';
}

/** 汇总一个父流程上的全部受控引用 */
export const listRefs=(w:Workflow|undefined,all:Workflow[]):RefView[]=>{
  if(!w)return [];
  return w.nodes.filter(isSubflowNode).map(node=>{
    const ref=getRef(node)!;
    const source=all.find(s=>s.id===ref.sourceId);
    const sourceArchived=source?.status==='archived';
    const published=[...(source?.versions||[])].sort((a,b)=>b.version-a.version)[0];
    const latestVersion=published?.version??null;
    const state:RefView['state']=sourceArchived
      ?'archived-source'
      :latestVersion!==null&&latestVersion>ref.pinnedVersion?'upgradable':'up-to-date';
    return {node,ref,source,sourceArchived,latestVersion,state};
  });
};

export interface RefCheckResult {
  status:'ready'|'blocked'|'up-to-date';
  targetVersion:number;
  gaps:string[];
}

/** 升级前确认接入点仍连得上且目标版本有结束节点；不满足就指出缺口 */
export const checkUpgrade=(parent:Workflow,node:FlowNode,all:Workflow[]):RefCheckResult=>{
  const ref=getRef(node);const gaps:string[]=[];
  if(!ref)return {status:'blocked',targetVersion:0,gaps:['节点不是受控子流程引用']};
  const source=all.find(s=>s.id===ref.sourceId);
  if(!source){gaps.push(`源流程 ${ref.sourceName} 已不存在`);return {status:'blocked',targetVersion:ref.pinnedVersion,gaps};}
  const latest=[...source.versions].sort((a,b)=>b.version-a.version)[0];
  const target=latest.version;
  if(target<=ref.pinnedVersion)return {status:'up-to-date',targetVersion:ref.pinnedVersion,gaps:[]};
  // 接入点：父流程画布上引用节点必须同时有上游和下游连线
  if(!parent.edges.some(e=>e.target===node.id))gaps.push('接入点缺少上游连线，升级后流程无法进入该子流程');
  if(!parent.edges.some(e=>e.source===node.id))gaps.push('接入点缺少下游连线，子流程结束后无法回到父流程');
  // 目标版本自身要有开始和结束节点
  const tv=source.versions.find(v=>v.version===target)!;
  if(!tv.nodes.some(n=>n.type==='start'))gaps.push(`目标版本 v${target} 缺少开始节点`);
  if(!tv.nodes.some(n=>n.type==='end'))gaps.push(`目标版本 v${target} 缺少结束节点`);
  return {status:gaps.length?'blocked':'ready',targetVersion:target,gaps};
};

/** 新插入时可选的源：只看已发布流程，且其最新发布版本带结束节点；已归档/草稿挡在外面 */
export const insertableSources=(currentId:string,all:Workflow[]):Workflow[]=>
  all.filter(w=>{
    if(w.id===currentId||w.status!=='published')return false;
    const latest=[...w.versions].sort((a,b)=>b.version-a.version)[0];
    return !!latest&&latest.nodes.some(n=>n.type==='end');
  });
