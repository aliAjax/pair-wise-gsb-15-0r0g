import type {FlowEdge,FlowNode,Instance,Workflow} from '../src/types';
const n=(id:string,type:FlowNode['type'],x:number,y:number,label:string,config:Record<string,any>={}):FlowNode=>({id,type,position:{x,y},data:{label,state:Object.keys(config).length?'valid':'unconfigured',config}});
const edge=(source:string,target:string,label?:string,i=0):FlowEdge=>({id:'e'+i,source,target,label});
const edgesOf=(list:[string,string,string?][]):FlowEdge[]=>list.map(([s,t,l],i)=>edge(s,t,l,i));
const standard=(broken=false)=>{
 const nodes=[n('start','start',20,150,'开始',{ok:true}),n('form','form',210,150,'提交申请',{fields:[{id:'reason',label:'申请说明',type:'text',required:true},{id:'amount',label:'申请金额',type:'amount',required:true},{id:'attachment',label:'附件',type:'attachment',required:false}]}),n('approval','approval',420,150,'直属主管审批',{approverSource:'直属主管',instruction:'请确认申请内容与预算归属'}),n('condition','condition',630,150,'金额判断',broken?{}:{ruleType:'amount',operator:'>',value:5000}),n('notify','notify',850,40,'高额通知',{targets:'财务审批人',template:'高额申请提醒',timing:'分支进入时'}),n('automation','automation',850,260,'记录系统',{action:'写入系统记录'}),n('end','end',1070,150,'结束',{ok:true})];
 const edges:FlowEdge[]=edgesOf([['start','form'],['form','approval'],['approval','condition'],['condition','notify','大于 5,000'],['condition','automation','其他'],['notify','end'],['automation','end']]); return {nodes,edges};
};
/** 子流程节点：插入时锁定一个已发布子流程版本 */
const sub=(id:string,x:number,y:number,sourceId:string,sourceName:string,pinnedVersion:number):FlowNode=>n(id,'subprocess',x,y,sourceName,{ref:{sourceId,sourceName,pinnedVersion}});

// —— 可复用的入职审批子流程（采购与人事共用同一套受控引用）——
const onboardingV1={
 nodes:[n('start','start',20,200,'开始',{ok:true}),n('form','form',210,200,'入职信息登记',{fields:[{id:'candidate',label:'入职人姓名',type:'text',required:true},{id:'date',label:'入职日期',type:'date',required:true}]}),n('approval','approval',420,200,'部门负责人审批',{approverSource:'直属主管',instruction:'确认岗位与报到安排'}),n('end','end',630,200,'结束',{ok:true})],
 edges:edgesOf([['start','form'],['form','approval'],['approval','end']])
};
const onboardingV2={
 nodes:[...onboardingV1.nodes.slice(0,3),n('hrbp','approval',620,200,'HRBP 复核',{approverSource:'固定角色',role:'HRBP',instruction:'复核合同、薪资与入职材料'}),n('it','automation',820,200,'开通账号权限',{action:'创建工单'}),n('end','end',1020,200,'结束',{ok:true})],
 edges:edgesOf([['start','form'],['form','approval'],['approval','hrbp'],['hrbp','it'],['it','end']])
};

const baseNames=['差旅费用审批','采购合同审批','员工入职流程','IT 服务请求','用印申请','供应商准入','年度预算调整','客户退款审批','法务审查流程','资产领用审批','营销活动报备','跨区域大型采购及多部门联合审批流程（集团特别管控版）'];
const baseWorkflows:Workflow[]=baseNames.map((name,i)=>{const graph=i===10?{nodes:[],edges:[]}:standard(i===0||i===3); if(i===8) graph.nodes=graph.nodes.filter(x=>x.type!=='end'); if(i===9) graph.nodes.push(n('orphan','approval',650,390,'孤立审批',{})); const status=i%4===0?'draft':i%5===0?'archived':'published'; const oldNodes=graph.nodes.filter(x=>x.id!=='notify').map(x=>({...x,data:{...x.data}})); return {id:'wf-'+(i+1),name,domain:['财务','采购','人力资源','IT服务','法务'][i%5],status,version:i%3+1,editor:['林秋','陈默','周礼','王宁'][i%4],updatedAt:`2026-07-${String(10-i%9).padStart(2,'0')} ${9+i%8}:20`,publishedAt:status==='published'?'2026-07-08 14:30':undefined,abnormalCount:i===7?0:i%4,nodes:graph.nodes,edges:graph.edges,versions:[{version:1,createdAt:'2026-06-12 10:00',note:'初始化流程结构',nodes:oldNodes,edges:graph.edges.filter(e=>e.source!=='notify'&&e.target!=='notify')},{version:2,createdAt:'2026-07-01 16:20',note:'增加金额分支与通知节点',nodes:graph.nodes,edges:graph.edges}]};});

const extraWorkflows:Workflow[]=[
 { // wf-13：已发布的共享子流程「入职审批（标准）」，v2 已发布
  id:'wf-13',name:'入职审批（标准）',domain:'人力资源',status:'published',version:2,editor:'周礼',updatedAt:'2026-07-09 11:10',publishedAt:'2026-07-09 11:10',abnormalCount:0,
  nodes:onboardingV2.nodes,edges:onboardingV2.edges,
  versions:[{version:1,createdAt:'2026-06-15 09:30',note:'初始版本：信息登记与部门审批',nodes:onboardingV1.nodes,edges:onboardingV1.edges},{version:2,createdAt:'2026-07-09 11:10',note:'新增 HRBP 复核与账号自动开通',nodes:onboardingV2.nodes,edges:onboardingV2.edges}]
 },
 { // wf-14：采购入职审批，锁定 v1，父流程显示「可升级 v2」
  id:'wf-14',name:'采购入职审批',domain:'采购',status:'published',version:3,editor:'陈默',updatedAt:'2026-07-09 14:20',publishedAt:'2026-07-05 10:00',abnormalCount:1,
  nodes:[n('s14-start','start',20,180,'开始',{ok:true}),n('s14-form','form',220,180,'采购岗位信息',{fields:[]}),sub('s14-ref',440,180,'wf-13','入职审批（标准）',1),n('s14-end','end',680,180,'结束',{ok:true})],
  edges:edgesOf([['s14-start','s14-form'],['s14-form','s14-ref'],['s14-ref','s14-end']]),
  versions:[{version:1,createdAt:'2026-07-02 09:00',note:'引用入职审批 v1',nodes:[],edges:[]},{version:2,createdAt:'2026-07-04 16:00',note:'补充采购岗位信息字段',nodes:[],edges:[]},{version:3,createdAt:'2026-07-05 10:00',note:'当前发布：仍锁定入职审批 v1',nodes:[],edges:[]}]
 },
 { // wf-15：人事入职审批，同样锁定 v1 —— 与采购各走各的引用，但升级互不影响
  id:'wf-15',name:'人事入职审批',domain:'人力资源',status:'published',version:1,editor:'周礼',updatedAt:'2026-07-08 17:40',publishedAt:'2026-07-06 09:30',abnormalCount:0,
  nodes:[n('s15-start','start',20,180,'开始',{ok:true}),n('s15-form','form',220,180,'员工信息录入',{fields:[]}),sub('s15-ref',440,180,'wf-13','入职审批（标准）',1),n('s15-notify','notify',660,180,'入职提醒',{targets:'行政',template:'工位与门禁准备',timing:'分支进入时'}),n('s15-end','end',880,180,'结束',{ok:true})],
  edges:edgesOf([['s15-start','s15-form'],['s15-form','s15-ref'],['s15-ref','s15-notify'],['s15-notify','s15-end']]),
  versions:[{version:1,createdAt:'2026-07-06 09:30',note:'发布：锁定入职审批 v1',nodes:[],edges:[]}]
 },
 { // wf-16：已发布子流程「IT 入职与权限开通」，最新发布版缺少结束节点 —— 升级会留在待处理并指出缺口
  id:'wf-16',name:'IT 入职与权限开通',domain:'IT服务',status:'published',version:2,editor:'王宁',updatedAt:'2026-07-09 18:05',publishedAt:'2026-07-09 18:05',abnormalCount:0,
  nodes:[n('it-start','start',20,180,'开始',{ok:true}),n('it-auto','automation',240,180,'开通账号',{action:'创建工单'})],
  edges:edgesOf([['it-start','it-auto']]),
  versions:[{version:1,createdAt:'2026-06-20 10:00',note:'初始版本（含结束节点）',nodes:[n('it-start','start',20,180,'开始',{ok:true}),n('it-end','end',440,180,'结束',{ok:true})],edges:[edge('it-start','it-end',undefined,0)]},{version:2,createdAt:'2026-07-09 18:05',note:'改为自动开通，结束节点被误删',nodes:[n('it-start','start',20,180,'开始',{ok:true}),n('it-auto','automation',240,180,'开通账号',{action:'创建工单'})],edges:[edge('it-start','it-auto',undefined,0)]}]
 },
 { // wf-17：父流程引用 wf-16 v1；子流程节点下游断开 + 目标版本无结束节点，升级产生两条缺口
  id:'wf-17',name:'外包人员入场审批',domain:'采购',status:'draft',version:1,editor:'陈默',updatedAt:'2026-07-10 17:05',abnormalCount:0,
  nodes:[n('s17-start','start',20,180,'开始',{ok:true}),n('s17-form','form',220,180,'外包人员登记',{fields:[]}),sub('s17-ref',440,180,'wf-16','IT 入职与权限开通',1),n('s17-end','end',700,300,'结束',{ok:true})],
  edges:edgesOf([['s17-start','s17-form'],['s17-form','s17-ref']]),
  versions:[{version:1,createdAt:'2026-07-03 11:00',note:'引用 IT 入职与权限开通 v1',nodes:[],edges:[]}],
  pendingRefs:{'s17-ref':[{nodeId:'s17-ref',message:'接入点缺失：子流程没有下游连线'},{nodeId:'s17-ref',message:'v2 缺少结束节点，升级后流程无法收尾'}]}
 },
 { // wf-18：引用已归档的 wf-6（供应商准入）——归档不带走引用，实例继续跑锁定版本，只挡住新插入
  id:'wf-18',name:'供应商年度复核',domain:'采购',status:'published',version:1,editor:'陈默',updatedAt:'2026-07-07 15:50',publishedAt:'2026-07-07 15:50',abnormalCount:0,
  nodes:[n('s18-start','start',20,180,'开始',{ok:true}),n('s18-form','form',220,180,'供应商资料',{fields:[]}),sub('s18-ref',440,180,'wf-6','供应商准入',2),n('s18-end','end',680,180,'结束',{ok:true})],
  edges:edgesOf([['s18-start','s18-form'],['s18-form','s18-ref'],['s18-ref','s18-end']]),
  versions:[{version:1,createdAt:'2026-07-07 15:50',note:'发布：锁定供应商准入 v2（源流程现已归档）',nodes:[],edges:[]}]
 }
];

export const workflows:Workflow[]=[...baseWorkflows,...extraWorkflows];

// —— 受控引用相关的演示实例：实例按插入时锁定的版本运行 ——
const extraInstances:Instance[]=[
 {id:'INS-2026-0081',workflowId:'wf-14',applicant:'苏菲',domain:'采购',currentNode:'入职审批（标准）',status:'running',submittedAt:'2026-07-10 09:40',duration:'3h 20m',risk:'low',timeline:[{title:'采购岗位信息',time:'09:40',status:'completed'},{title:'入职审批（标准）',time:'10:05',status:'current'}],subprocessLocks:[{sourceId:'wf-13',sourceName:'入职审批（标准）',version:1}]},
 {id:'INS-2026-0082',workflowId:'wf-14',applicant:'方可',domain:'采购',currentNode:'结束',status:'completed',submittedAt:'2026-07-08 14:10',duration:'5h 02m',risk:'low',timeline:[{title:'采购岗位信息',time:'14:10',status:'completed'},{title:'入职审批（标准）',time:'14:35',status:'completed'}],subprocessLocks:[{sourceId:'wf-13',sourceName:'入职审批（标准）',version:1}]},
 {id:'INS-2026-0083',workflowId:'wf-18',applicant:'陆远',domain:'采购',currentNode:'供应商准入',status:'running',submittedAt:'2026-07-09 16:00',duration:'18h 10m',risk:'medium',timeline:[{title:'供应商资料',time:'16:00',status:'completed'},{title:'供应商准入',time:'16:30',status:'current'}],subprocessLocks:[{sourceId:'wf-6',sourceName:'供应商准入',version:2}]}
];
export {extraInstances};
