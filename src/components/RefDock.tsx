import {AlertTriangle,Archive,ArrowUpCircle,CheckCircle2,Link2,Lock,RefreshCw,X} from 'lucide-react';
import type {RefView} from '../lib/refs';

const stateMeta:Record<RefView['state'],{label:string;icon:any;cls:string}>={
  current:{label:'当前版本',icon:CheckCircle2,cls:'ok'},
  upgradable:{label:'可升级',icon:ArrowUpCircle,cls:'up'},
  pending:{label:'待处理',icon:AlertTriangle,cls:'warn'},
  archived:{label:'源已归档',icon:Archive,cls:'muted'},
  missing:{label:'源缺失',icon:AlertTriangle,cls:'warn'},
};

/** 列表单元格用的紧凑徽标 */
export function RefBadges({refs}:{refs:RefView[]}){
  const up=refs.filter(r=>r.state==='upgradable').length;
  const pending=refs.filter(r=>r.state==='pending').length;
  const archived=refs.filter(r=>r.state==='archived').length;
  if(!refs.length)return null;
  return <span className="ref-badges">
    <span className="ref-mini locked" title="受控子流程引用"><Link2/>{refs.length} 引用</span>
    {up>0&&<span className="ref-mini up" data-testid="ref-upgradable-badge" title="有新版本可升级"><ArrowUpCircle/>{up} 待升级</span>}
    {pending>0&&<span className="ref-mini warn" data-testid="ref-pending-badge" title="升级预检未通过"><AlertTriangle/>{pending} 待处理</span>}
    {archived>0&&<span className="ref-mini" data-testid="ref-archived-badge" title="源流程已归档：引用保留，不能新建"><Archive/>源已归档</span>}
  </span>;
}

export function RefDock({refs,onSelect,onUpgrade,onRetry,onDismiss,title='受控子流程引用',desc}:{
  refs:RefView[];
  onSelect?:(nodeId:string)=>void;
  onUpgrade?:(nodeId:string)=>void;
  onRetry?:(nodeId:string)=>void;
  onDismiss?:(nodeId:string)=>void;
  title?:string;desc?:string;
}){
  if(!refs.length)return null;
  return <section className="panel ref-dock" data-testid="ref-dock">
    <div className="ref-dock-head"><div><h3><Link2/>{title}</h3><p>{desc??'插入时锁定已发布版本；源流程发布新版后这里只提示可升级，不会自动改动父流程。'}</p></div></div>
    <div className="ref-list">
      {refs.map(r=>{
        const meta=stateMeta[r.state];const Icon=meta.icon;
        return <article key={r.nodeId} className={'ref-row '+meta.cls} data-testid="ref-row" data-ref-state={r.state}>
          <button className="ref-main" onClick={()=>onSelect?.(r.nodeId)}>
            <span className="ref-state"><Icon/></span>
            <div className="ref-info">
              <b>{r.ref.sourceName}</b>
              <small><Lock/>锁定 v{r.ref.pinnedVersion}
                {r.state==='upgradable'&&<> · 最新 <em>v{r.latestVersion}</em></>}
                {r.state==='archived'&&' · 源流程已归档，引用保留'}
                {r.state==='missing'&&' · 源流程缺失'}
              </small>
            </div>
            <span className={'ref-tag '+meta.cls}>{meta.label}</span>
          </button>
          <div className="ref-actions">
            {r.state==='upgradable'&&onUpgrade&&<button data-testid="ref-upgrade" onClick={()=>onUpgrade(r.nodeId)}><ArrowUpCircle/>升级到 v{r.latestVersion}</button>}
            {r.state==='pending'&&onRetry&&<button className="secondary" data-testid="ref-retry" onClick={()=>onRetry(r.nodeId)}><RefreshCw/>重新检查</button>}
            {r.state==='pending'&&onDismiss&&<button className="icon-btn" data-testid="ref-dismiss" title="保留在插入版本" onClick={()=>onDismiss(r.nodeId)}><X/></button>}
          </div>
          {r.state==='pending'&&<ul className="ref-gaps" data-testid="ref-gaps">
            {r.gaps.map((g,i)=><li key={i}><AlertTriangle/>{g.message}</li>)}
          </ul>}
        </article>;
      })}
    </div>
  </section>;
}
