import type {FlowNode, RefGap, SubprocessRef, Workflow} from '../types';

export type RefState='current'|'upgradable'|'pending'|'archived'|'missing';

export interface RefView {
  nodeId: string;
  ref: SubprocessRef;
  state: RefState;
  /** 源流程当前最新发布版本；源缺失或未发布过时为 undefined */
  latestVersion?: number;
  sourceStatus?: Workflow['status'];
  gaps: RefGap[];
}

export const refOf=(node:FlowNode):SubprocessRef|undefined=>node.type==='subprocess'?node.data.config.ref:undefined;

export const refNodes=(w:Workflow):FlowNode[]=>w.nodes.filter(n=>n.type==='subprocess'&&n.data.config.ref);

export interface RefSummary {current:number;upgradable:number;pending:number;archived:number;missing:number}

/** 取流程内所有子流程引用的实时状态（源流程升级会即时反映，不回写锁定版本） */
export function resolveRefs(w:Workflow, all:Workflow[]):RefView[] {
  return refNodes(w).map(node=>{
    const ref=node.data.config.ref as SubprocessRef;
    const stored=w.pendingRefs?.[node.id];
    const source=all.find(s=>s.id===ref.sourceId);
    if(!source) return {nodeId:node.id,ref,state:'missing',gaps:stored??[{nodeId:node.id,message:'源流程已不存在，无法升级'}]};
    const latestVersion=source.versions.at(-1)?.version;
    if(stored?.length) return {nodeId:node.id,ref,state:'pending',latestVersion,sourceStatus:source.status,gaps:stored};
    if(source.status==='archived') return {nodeId:node.id,ref,state:'archived',latestVersion,gaps:[]};
    if(latestVersion!==undefined&&latestVersion>ref.pinnedVersion) return {nodeId:node.id,ref,state:'upgradable',latestVersion,gaps:[]};
    return {nodeId:node.id,ref,state:'current',latestVersion,gaps:[]};
  });
}

export const summarizeRefs=(refs:RefView[]):RefSummary=>refs.reduce<RefSummary>((acc,r)=>{acc[r.state]++;return acc},{current:0,upgradable:0,pending:0,archived:0,missing:0});

/**
 * 升级前置检查：
 * 1. 接入点仍连得上——子流程节点在父流程中必须有入边和出边；
 * 2. 新版本必须有结束节点；
 * 3. 新版本快照仍存在。
 */
export function preflightUpgrade(parent:Workflow,nodeId:string,targetVersion:number,all:Workflow[]):RefGap[] {
  const gaps:RefGap[]=[];
  const node=parent.nodes.find(n=>n.id===nodeId);
  if(!node||!node.data.config.ref) return [{nodeId,message:'子流程引用已丢失，无法升级'}];
  const inEdge=parent.edges.some(e=>e.target===nodeId), outEdge=parent.edges.some(e=>e.source===nodeId);
  if(!inEdge) gaps.push({nodeId,message:'接入点缺失：子流程没有上游连线'});
  if(!outEdge) gaps.push({nodeId,message:'接入点缺失：子流程没有下游连线'});
  const source=all.find(w=>w.id===node.data.config.ref.sourceId);
  const snap=source?.versions.find(v=>v.version===targetVersion);
  if(!snap) gaps.push({nodeId,message:`新版本 v${targetVersion} 快照不存在，无法升级`});
  else if(!snap.nodes.some(n=>n.type==='end')) gaps.push({nodeId,message:`v${targetVersion} 缺少结束节点，升级后流程无法收尾`});
  return gaps;
}
