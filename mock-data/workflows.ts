import type {FlowEdge,FlowNode,Workflow,Version} from '../src/types';
const n=(id:string,type:FlowNode['type'],x:number,y:number,label:string,config:Record<string,any>={}):FlowNode=>({id,type,position:{x,y},data:{label,state:Object.keys(config).length?'valid':'unconfigured',config}});
const links=(pairs:[string,string,string?][]):FlowEdge[]=>pairs.map((e,i)=>({id:'e'+i,source:e[0],target:e[1],label:e[2]}));
const standard=(broken=false)=>{
 const nodes=[n('start','start',20,150,'开始',{ok:true}),n('form','form',210,150,'提交申请',{fields:[{id:'reason',label:'申请说明',type:'text',required:true},{id:'amount',label:'申请金额',type:'amount',required:true},{id:'attachment',label:'附件',type:'attachment',required:false}]}),n('approval','approval',420,150,'直属主管审批',{approverSource:'直属主管',instruction:'请确认申请内容与预算归属'}),n('condition','condition',630,150,'金额判断',broken?{}:{ruleType:'amount',operator:'>',value:5000}),n('notify','notify',850,40,'高额通知',{targets:'财务审批人',template:'高额申请提醒',timing:'分支进入时'}),n('automation','automation',850,260,'记录系统',{action:'写入系统记录'}),n('end','end',1070,150,'结束',{ok:true})];
 const edges:FlowEdge[]=[['start','form'],['form','approval'],['approval','condition'],['condition','notify','大于 5,000'],['condition','automation','其他'],['notify','end'],['automation','end']].map((e,i)=>({id:'e'+i,source:e[0],target:e[1],label:e[2]})); return {nodes,edges};
};
/** 受控子流程引用节点：插入时锁定一个已发布版本 */
const sf=(id:string,x:number,y:number,label:string,ref:Record<string,any>):FlowNode=>n(id,'subflow',x,y,label,ref);

// wf-3 员工入职审批（共享子流程源，已发布 v1/v2/v3）
const onboarding:{nodes:FlowNode[];edges:FlowEdge[];versions:Version[]}={
 nodes:[n('start','start',20,200,'开始',{ok:true}),n('form','form',210,200,'入职信息登记',{fields:[{id:'candidate',label:'候选人信息',type:'text',required:true},{id:'position',label:'入职岗位',type:'text',required:true}]}),n('approval','approval',420,200,'直属主管确认',{approverSource:'直属主管',instruction:'确认岗位与到岗日期'}),n('approval','approval',630,200,'部门负责人会签',{approverSource:'固定角色',role:'部门负责人',instruction:'确认编制与薪资'}),n('automation','automation',840,200,'账号开通',{action:'创建工单'}),n('end','end',1050,200,'结束',{ok:true})],
 edges:links([['start','form'],['form','approval'],['approval','approval-2','直属主管确认'],['approval-2','automation','部门负责人会签'],['automation','end']]),
 versions:[
  {version:1,createdAt:'2026-05-08 10:00',note:'入职申请与主管确认',nodes:[n('start','start',20,200,'开始',{ok:true}),n('form','form',210,200,'入职信息登记',{fields:[]}),n('approval','approval',420,200,'直属主管确认',{approverSource:'直属主管'})],edges:links([['start','form'],['form','approval']])},
  {version:2,createdAt:'2026-06-02 14:20',note:'增加部门负责人会签',nodes:[n('start','start',20,200,'开始',{ok:true}),n('form','form',210,200,'入职信息登记',{fields:[]}),n('approval','approval',420,200,'直属主管确认',{approverSource:'直属主管'}),n('approval-2','approval',630,200,'部门负责人会签',{approverSource:'固定角色',role:'部门负责人'}),n('end','end',840,200,'结束',{ok:true})],edges:links([['start','form'],['form','approval'],['approval','approval-2'],['approval-2','end']])},
  {version:3,createdAt:'2026-07-03 09:40',note:'会签后自动开通账号',nodes:[],edges:[]},
 ],
};
onboarding.versions[2].nodes=onboarding.nodes; onboarding.versions[2].edges=onboarding.edges;

// wf-6 供应商准入（已归档源，引用仍然可用，只是挡住新的插入）
const supplier={nodes:[n('start','start',20,180,'开始',{ok:true}),n('form','form',210,180,'供应商资料提交',{fields:[{id:'vendor',label:'供应商名称',type:'text',required:true}]}),n('approval','approval',420,180,'采购专员审核',{approverSource:'固定角色',role:'采购专员'}),n('end','end',630,180,'结束',{ok:true})],edges:links([['start','form'],['form','approval'],['approval','end']])};
const supplierV2={nodes:[...supplier.nodes,n('approval-2','approval',630,60,'合规复核',{approverSource:'固定角色',role:'法务经理'}),n('end','end',840,180,'结束',{ok:true})].filter(x=>x.id!=='end'),edges:links([['start','form'],['form','approval'],['approval','approval-2'],['approval-2','end']])};

// wf-13 合规会签子流程（已发布 v2 缺结束节点：升级会被挡下）
const compliance={
 nodes:[n('start','start',20,180,'开始',{ok:true}),n('form','form',210,180,'会签材料提交',{fields:[{id:'doc',label:'会签文件',type:'attachment',required:true}]}),n('approval','approval',420,180,'法务经理会签',{approverSource:'固定角色',role:'法务经理'})],
 edges:links([['start','form'],['form','approval']]),
};
const complianceV1:Version={version:1,createdAt:'2026-05-20 11:00',note:'法务会签初版',nodes:[...compliance.nodes,n('end','end',630,180,'结束',{ok:true})],edges:links([['start','form'],['form','approval'],['approval','end']])};
const complianceV2:Version={version:2,createdAt:'2026-06-25 16:10',note:'增加合规复核（结束节点待补）',nodes:[...compliance.nodes,n('approval-2','approval',630,60,'合规复核',{approverSource:'固定角色',role:'法务经理'})],edges:links([['start','form'],['form','approval'],['approval','approval-2']])};

const names=['差旅费用审批','采购合同审批','员工入职流程','IT 服务请求','用印申请','供应商准入','年度预算调整','客户退款审批','法务审查流程','资产领用审批','营销活动报备','跨区域大型采购及多部门联合审批流程（集团特别管控版）','合规会签子流程'];

export const workflows:Workflow[]=names.map((name,i)=>{
 const idx=i+1;
 let graph=idx===11?{nodes:[] as FlowNode[],edges:[] as FlowEdge[]}:standard(i===0||i===3);
 if(idx===9) graph.nodes=graph.nodes.filter(x=>x.type!=='end');
 if(idx===10) graph.nodes.push(n('orphan','approval',650,390,'孤立审批',{}));
 const status=idx%4===0?'draft':idx%5===0?'archived':'published';
 const oldNodes=graph.nodes.filter(x=>x.id!=='notify').map(x=>({...x,data:{...x.data}}));
 let override:Partial<Workflow>|null=null;

 if(idx===2){
  // 采购合同审批：插入员工入职审批 v2，源已发布 v3 —— 可升级
  const nodes=[n('start','start',20,150,'开始',{ok:true}),n('form','form',200,150,'采购需求登记',{fields:[{id:'contract',label:'合同名称',type:'text',required:true},{id:'amount',label:'合同金额',type:'amount',required:true}]}),sf('subflow-onb',400,150,'入职审批（受控）',{sourceId:'wf-3',sourceName:'员工入职流程',pinnedVersion:2,insertedVersion:2,runningInstances:3}),n('condition','condition',620,150,'金额判断',{ruleType:'amount',operator:'>',value:5000}),n('notify','notify',840,40,'高额通知',{targets:'财务审批人',template:'高额合同提醒'}),n('automation','automation',840,260,'记录系统',{action:'写入系统记录'}),n('end','end',1060,150,'结束',{ok:true})];
  const edges=links([['start','form'],['form','subflow-onb'],['subflow-onb','condition','员工入职审批 v2'],['condition','notify','大于 5,000'],['condition','automation','其他'],['notify','end'],['automation','end']]);
  override={status:'published',version:2,publishedAt:'2026-07-06 10:20',updatedAt:'2026-07-06 10:20',abnormalCount:1,nodes,edges,versions:[{version:1,createdAt:'2026-06-18 09:00',note:'初始化采购审批结构',nodes:[n('start-v1','start',20,150,'开始',{ok:true}),n('form-v1','form',210,150,'采购需求登记',{fields:[]}),n('condition-v1','condition',420,150,'金额判断',{ruleType:'amount',operator:'>',value:5000}),n('end-v1','end',630,150,'结束',{ok:true})],edges:links([['start-v1','form-v1'],['form-v1','condition-v1'],['condition-v1','end-v1']])},{version:2,createdAt:'2026-07-06 10:20',note:'以受控引用接入员工入职审批 v2',nodes,edges}]};
 }
 if(idx===3){
  override={status:'published',version:3,publishedAt:'2026-07-03 09:40',updatedAt:'2026-07-03 09:40',abnormalCount:0,nodes:onboarding.nodes,edges:onboarding.edges,versions:onboarding.versions};
 }
 if(idx===5){
  // 用印申请：引用已归档的供应商准入 v1，源 v2 已归档 —— 新插入被挡，引用照常运行
  const nodes=[n('start','start',20,180,'开始',{ok:true}),n('form','form',210,180,'用印登记',{fields:[{id:'seal',label:'印章类型',type:'text',required:true}]}),sf('subflow-sup',420,180,'供应商准入（受控）',{sourceId:'wf-6',sourceName:'供应商准入',pinnedVersion:1,insertedVersion:1,runningInstances:1}),n('end','end',640,180,'结束',{ok:true})];
  const edges=links([['start','form'],['form','subflow-sup'],['subflow-sup','end','供应商准入 v1']]);
  override={status:'published',version:2,publishedAt:'2026-06-28 15:00',updatedAt:'2026-06-30 09:10',abnormalCount:0,nodes,edges};
 }
 if(idx===6){
  override={status:'archived',version:2,publishedAt:'2026-05-30 14:00',updatedAt:'2026-06-20 17:30',abnormalCount:0,nodes:supplierV2.nodes,edges:supplierV2.edges,versions:[{version:1,createdAt:'2026-05-12 09:30',note:'供应商资料与采购审核',nodes:supplier.nodes,edges:supplier.edges},{version:2,createdAt:'2026-05-30 14:00',note:'增加合规复核',nodes:supplierV2.nodes,edges:supplierV2.edges}]};
 }
 if(idx===7){
  // 年度预算调整：引用入职审批 v2 但接入点没有下游连线 —— 升级检查留在待处理并指出缺口
  const nodes=[n('start','start',20,180,'开始',{ok:true}),n('form','form',210,180,'预算调整登记',{fields:[{id:'budget',label:'调整金额',type:'amount',required:true}]}),sf('subflow-onb',420,180,'入职审批（受控）',{sourceId:'wf-3',sourceName:'员工入职流程',pinnedVersion:2,insertedVersion:2,runningInstances:0,check:{targetVersion:3,status:'blocked',gaps:['接入点缺少下游连线，子流程结束后无法回到父流程'],checkedAt:'2026-07-08 11:20'}}),n('end','end',700,180,'结束',{ok:true})];
  const edges=links([['start','form'],['form','subflow-onb']]);
  override={status:'published',version:1,publishedAt:'2026-07-02 13:00',updatedAt:'2026-07-08 11:20',abnormalCount:2,nodes,edges};
 }
 if(idx===9){
  // 法务审查流程：引用合规会签 v1，v2 缺结束节点 —— 升级被挡
  const nodes=[n('start','start',20,150,'开始',{ok:true}),n('form','form',210,150,'审查材料提交',{fields:[{id:'doc',label:'审查文件',type:'attachment',required:true}]}),sf('subflow-comp',420,150,'合规会签（受控）',{sourceId:'wf-13',sourceName:'合规会签子流程',pinnedVersion:1,insertedVersion:1,runningInstances:0}),n('approval','approval',640,150,'法务复核',{approverSource:'固定角色',role:'法务经理'})];
  const edges=links([['start','form'],['form','subflow-comp'],['subflow-comp','approval','合规会签 v1']]);
  override={status:'published',version:2,publishedAt:'2026-07-05 16:40',updatedAt:'2026-07-05 16:40',abnormalCount:3,nodes,edges};
 }
 if(idx===13){
  override={status:'published',version:2,domain:'法务',publishedAt:'2026-06-25 16:10',updatedAt:'2026-06-25 16:10',abnormalCount:0,nodes:complianceV2.nodes,edges:complianceV2.edges,versions:[complianceV1,complianceV2]};
 }

 const base:Workflow={id:'wf-'+idx,name,domain:['财务','采购','人力资源','IT服务','法务'][i%5],status,version:i%3+1,editor:['林秋','陈默','周礼','王宁'][i%4],updatedAt:`2026-07-${String(10-i%9).padStart(2,'0')} ${9+i%8}:20`,publishedAt:status==='published'?'2026-07-08 14:30':undefined,abnormalCount:i===7?0:i%4,nodes:graph.nodes,edges:graph.edges,versions:[{version:1,createdAt:'2026-06-12 10:00',note:'初始化流程结构',nodes:oldNodes,edges:graph.edges.filter(e=>e.source!=='notify'&&e.target!=='notify')},{version:2,createdAt:'2026-07-01 16:20',note:'增加金额分支与通知节点',nodes:graph.nodes,edges:graph.edges}]};
 return override?{...base,...override}:base;
});
