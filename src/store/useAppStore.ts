import {create} from 'zustand';
import {workflows as seed} from '../../mock-data/workflows';
import {instances} from '../../mock-data/instances';
import type {FlowEdge,FlowNode,SubprocessRef,ValidationIssue,Workflow} from '../types';
import {preflightUpgrade,refNodes} from '../lib/refs';

const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
const NOW='2026-07-11 16:35';

const validate=(w:Workflow):ValidationIssue[]=>{
  const issues:ValidationIssue[]=[];
  if(!w.nodes.some(n=>n.type==='end')) issues.push({nodeId:w.nodes[0]?.id||'flow',level:'error',message:'流程缺少结束节点'});
  const linked=new Set(w.edges.flatMap(e=>[e.source,e.target]));
  w.nodes.filter(n=>n.type!=='start'&&n.type!=='end'&&!linked.has(n.id)).forEach(n=>issues.push({nodeId:n.id,level:'error',message:'必经节点不能孤立'}));
  w.nodes.forEach(n=>{
    if(n.type==='condition'&&!n.data.config.ruleType)issues.push({nodeId:n.id,level:'error',message:'条件分支规则未配置'});
    if(n.type==='approval'&&!n.data.config.approverSource)issues.push({nodeId:n.id,level:'error',message:'审批人不能为空'});
    if(n.type==='subprocess'&&!n.data.config.ref)issues.push({nodeId:n.id,level:'error',message:'子流程未绑定已发布版本'});
  });
  // 升级预检留在待处理的引用：不阻塞编辑，但需要明确提示
  Object.values(w.pendingRefs??{}).flat().forEach(g=>issues.push({nodeId:g.nodeId,level:'warning',message:'子流程升级待处理：'+g.message}));
  return issues;
};

interface State{
  workflows:Workflow[];instances:typeof instances;currentId:string;selectedNodeId:string|null;issues:ValidationIssue[];toast:string;
  setCurrent:(id:string)=>void;selectNode:(id:string|null)=>void;
  updateNodes:(nodes:FlowNode[])=>void;updateEdges:(edges:FlowEdge[])=>void;updateConfig:(id:string,config:Record<string,any>)=>void;
  runValidation:()=>ValidationIssue[];save:()=>void;publish:()=>void;create:()=>string;copy:(id:string)=>void;archive:(id:string)=>void;restore:(v:number)=>void;clearToast:()=>void;
  bindRef:(nodeId:string,ref:SubprocessRef)=>void;attemptRefUpgrade:(nodeId:string)=>void;retryPendingRef:(nodeId:string)=>void;dismissPendingRef:(nodeId:string)=>void;
}

export const useAppStore=create<State>((set,get)=>({
  workflows:clone(seed),instances,currentId:'wf-1',selectedNodeId:null,issues:[],toast:'',
  setCurrent:id=>set({currentId:id,selectedNodeId:null,issues:[]}),
  selectNode:id=>set({selectedNodeId:id}),
  updateNodes:nodes=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,nodes}:w)})),
  updateEdges:edges=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,edges}:w)})),
  updateConfig:(id,config)=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,nodes:w.nodes.map(n=>n.id===id?{...n,data:{...n.data,config:{...n.data.config,...config},state:'configuring'}}:n)}:w)})),
  runValidation:()=>{
    const w=get().workflows.find(x=>x.id===get().currentId)!;
    const issues=validate(w);
    set(s=>({issues,workflows:s.workflows.map(x=>x.id===w.id?{...x,nodes:x.nodes.map(n=>({...n,data:{...n.data,state:issues.some(i=>i.nodeId===n.id&&i.level==='error')?'invalid':'valid'}}))}:x),toast:issues.length?`发现 ${issues.length} 个问题`:'校验通过'}));
    return issues;
  },
  save:()=>set(s=>({workflows:s.workflows.map(w=>w.id===s.currentId?{...w,status:'draft',updatedAt:'2026-07-11 16:30'}:w),toast:'草稿已保存'})),
  publish:()=>set(s=>({workflows:s.workflows.map(w=>{
    if(w.id!==s.currentId)return w;
    // 发布即冻结一个新版本快照；已插入的子流程引用按各自锁定版本原样写入快照
    return {...w,status:'published',version:w.version+1,publishedAt:NOW,updatedAt:NOW,
      versions:[...w.versions,{version:w.version+1,createdAt:NOW,note:w.versions.length?'发布最新审批配置':'首次发布',nodes:clone(w.nodes),edges:clone(w.edges)}]};
  }),toast:'流程发布成功'})),
  create:()=>{
    const id='wf-'+Date.now();
    set(s=>({workflows:[{id,name:'未命名流程',domain:'财务',status:'draft',version:0,editor:'林秋',updatedAt:'2026-07-11 16:40',abnormalCount:0,nodes:[],edges:[],versions:[]},...s.workflows],currentId:id}));
    return id;
  },
  copy:id=>set(s=>{
    const w=s.workflows.find(x=>x.id===id)!;
    const refCount=refNodes(w).length;
    return {workflows:[{...clone(w),id:'wf-'+Date.now(),name:w.name+'（副本）',status:'draft'},...s.workflows],
      toast:refCount?`副本已创建，保留 ${refCount} 个受控子流程引用（仍锁定插入版本）`:'副本已创建'};
  }),
  archive:id=>set(s=>{
    const referenced=s.workflows.filter(w=>w.id!==id&&refNodes(w).some(n=>n.data.config.ref.sourceId===id)).length;
    return {workflows:s.workflows.map(w=>w.id===id?{...w,status:'archived'}:w),
      toast:referenced?`已归档：${referenced} 个父流程的现有引用与运行实例保留，仅阻止新的插入`:'流程已归档'};
  }),
  restore:v=>set(s=>({workflows:s.workflows.map(w=>{
    if(w.id!==s.currentId)return w;
    const old=w.versions.find(x=>x.version===v)!;
    return {...w,status:'draft',nodes:clone(old.nodes),edges:clone(old.edges),pendingRefs:undefined};
  }),toast:`已恢复 v${v} 为草稿`})),
  clearToast:()=>set({toast:''}),

  // 插入/绑定子流程：只允许选择已发布流程，并锁定其最新发布版本
  bindRef:(nodeId,ref)=>set(s=>({workflows:s.workflows.map(w=>{
    if(w.id!==s.currentId)return w;
    const pendingRefs={...(w.pendingRefs??{})};delete pendingRefs[nodeId];
    return {...w,pendingRefs:Object.keys(pendingRefs).length?pendingRefs:undefined,
      nodes:w.nodes.map(n=>n.id===nodeId?{...n,data:{...n.data,label:ref.sourceName,state:'valid',config:{ref}}}:n)};
  }),toast:`已插入并锁定 ${ref.sourceName} v${ref.pinnedVersion}`})),

  // 升级：先做接入点与结束节点预检；不通过则保留锁定版本、留在待处理并指出缺口
  attemptRefUpgrade:nodeId=>set(s=>{
    const parent=s.workflows.find(w=>w.id===s.currentId)!;
    const node=parent.nodes.find(n=>n.id===nodeId);
    const cur=node?.data.config.ref as SubprocessRef|undefined;
    const source=cur?s.workflows.find(w=>w.id===cur.sourceId):undefined;
    const target=source?.versions.at(-1)?.version;
    if(!cur||!source||target===undefined) return {toast:'暂无可升级版本'};
    const gaps=preflightUpgrade(parent,nodeId,target,s.workflows);
    if(gaps.length) return {workflows:s.workflows.map(w=>w.id===parent.id?{...w,pendingRefs:{...(w.pendingRefs??{}),[nodeId]:gaps}}:w),
      toast:`升级未通过预检，已留在待处理（${gaps.length} 项缺口）`};
    const next:SubprocessRef={...cur,pinnedVersion:target};
    return {workflows:s.workflows.map(w=>w.id===parent.id?{...w,
      pendingRefs:(()=>{const p={...(w.pendingRefs??{})};delete p[nodeId];return Object.keys(p).length?p:undefined})(),
      nodes:w.nodes.map(n=>n.id===nodeId?{...n,data:{...n.data,config:{ref:next}}}:n)}:w),
      toast:`已升级到 ${cur.sourceName} v${target}，已有实例仍按插入版本运行`};
  }),

  // 待处理项重新检查（父流程连线修复后可再试）
  retryPendingRef:nodeId=>set(s=>{
    const parent=s.workflows.find(w=>w.id===s.currentId)!;
    const node=parent.nodes.find(n=>n.id===nodeId);
    const cur=node?.data.config.ref as SubprocessRef|undefined;
    const source=cur?s.workflows.find(w=>w.id===cur.sourceId):undefined;
    const target=source?.versions.at(-1)?.version;
    if(!cur||target===undefined) return {};
    const gaps=preflightUpgrade(parent,nodeId,target,s.workflows);
    if(gaps.length) return {workflows:s.workflows.map(w=>w.id===parent.id?{...w,pendingRefs:{...(w.pendingRefs??{}),[nodeId]:gaps}}:w),
      toast:`仍有 ${gaps.length} 项缺口未解决`};
    const next:SubprocessRef={...cur,pinnedVersion:target};
    return {workflows:s.workflows.map(w=>w.id===parent.id?{...w,
      pendingRefs:(()=>{const p={...(w.pendingRefs??{})};delete p[nodeId];return Object.keys(p).length?p:undefined})(),
      nodes:w.nodes.map(n=>n.id===nodeId?{...n,data:{...n.data,config:{ref:next}}}:n)}:w),
      toast:`缺口已解决，已升级到 v${target}`};
  }),

  // 放弃升级：清除待处理标记，继续停留在插入版本
  dismissPendingRef:nodeId=>set(s=>({workflows:s.workflows.map(w=>{
    if(w.id!==s.currentId)return w;
    const p={...(w.pendingRefs??{})};delete p[nodeId];
    return {...w,pendingRefs:Object.keys(p).length?p:undefined};
  }),toast:'已保留在插入版本，待处理项已清除'})),
}));
