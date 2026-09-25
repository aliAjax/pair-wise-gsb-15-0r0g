export type WorkflowStatus='draft'|'published'|'archived';
export type NodeKind='start'|'form'|'approval'|'condition'|'automation'|'notify'|'subprocess'|'end';
export type NodeState='unconfigured'|'configuring'|'valid'|'invalid';
export interface FormField {id:string;label:string;type:'text'|'number'|'amount'|'date'|'select'|'attachment';required:boolean;options?:string[]}
export interface FlowNode {id:string;type:NodeKind;position:{x:number;y:number};data:{label:string;state:NodeState;config:Record<string,any>}}
export interface FlowEdge {id:string;source:string;target:string;label?:string}
export interface Version {version:number;createdAt:string;note:string;nodes:FlowNode[];edges:FlowEdge[]}
/** 升级预检未通过时记录的缺口，按子流程节点 id 挂在父流程上（待处理状态） */
export interface RefGap {nodeId:string;message:string}
/** 子流程节点锁定的受控引用：插入时锁定源流程的一个已发布版本 */
export interface SubprocessRef {sourceId:string;sourceName:string;pinnedVersion:number}
export interface Workflow {id:string;name:string;domain:string;status:WorkflowStatus;version:number;editor:string;updatedAt:string;publishedAt?:string;abnormalCount:number;nodes:FlowNode[];edges:FlowEdge[];versions:Version[];pendingRefs?:Record<string,RefGap[]>}
/** 实例运行期间锁定的子流程版本：源流程升级/归档都不改变实例实际运行版本 */
export interface InstanceSubprocessLock {sourceId:string;sourceName:string;version:number}
export interface Instance {id:string;workflowId:string;applicant:string;domain:string;currentNode:string;status:'abnormal'|'timeout'|'running'|'completed';submittedAt:string;duration:string;risk:'high'|'medium'|'low';timeline:{title:string;time:string;status:string}[];subprocessLocks?:InstanceSubprocessLock[]}
export interface ValidationIssue {nodeId:string;level:'error'|'warning';message:string}
