"use client";
import type { ReactNode } from "react";
import { MdChevronRight } from "react-icons/md";

export function PageHeading({title,subtitle,action}:{title:string;subtitle?:string;action?:ReactNode}) {
  return <div className="editorial-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>;
}
export function MaterialContext({course,folder}:{course?:string;folder?:string}) {
  return <div className="material-context">{course&&<span>{course}</span>}{course&&folder&&<MdChevronRight aria-hidden="true"/>}{folder&&<span>{folder}</span>}</div>;
}
export function WorkflowSteps({current,labels}:{current:number;labels:string[]}) {
  return <ol className="workflow-steps" aria-label="目前步驟">{labels.map((label,index)=><li key={label} aria-current={current===index?"step":undefined} className={index<=current?"reached":""}><span/>{label}</li>)}</ol>;
}
export function PageActions({children}:{children:ReactNode}) {
  return <div className="page-action-dock">{children}</div>;
}
