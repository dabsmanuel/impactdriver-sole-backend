import { Request, Response, NextFunction } from "express";
import PDFDocument from "pdfkit";
import { Project } from "../models/Project";
import { ProjectTemplate } from "../models/ProjectTemplate";

const C = { ink: "#141918", paper: "#F5F3EE", surface: "#EDEAE3", rule: "#C7C2B8", accent: "#B8520A", slate: "#4A5750", white: "#FFFFFF" };
function hex(h: string): [number, number, number] { const n = parseInt(h.replace("#",""),16); return [(n>>16)&0xff,(n>>8)&0xff,n&0xff]; }
const PAGE_W=595.28, PAGE_H=841.89, ML=72, MR=72, MT=72, COL_W=PAGE_W-ML-MR;

function hrule(doc: PDFKit.PDFDocument, y: number, color=C.rule, t=0.5) {
  doc.save().strokeColor(hex(color)).lineWidth(t).moveTo(ML,y).lineTo(PAGE_W-MR,y).stroke().restore();
}

function sectionHeader(doc: PDFKit.PDFDocument, code: string, title: string) {
  doc.moveDown(0.7); const y=doc.y;
  doc.save().font("Courier").fontSize(8).fillColor(hex(C.accent)).text(code,ML,y,{continued:false}).restore();
  doc.save().font("Times-Bold").fontSize(14).fillColor(hex(C.ink)).text(title,ML+28,y).restore();
  doc.moveDown(0.2); hrule(doc,doc.y,C.ink,1.5); doc.moveDown(0.5);
}

function fieldLabel(doc: PDFKit.PDFDocument, text: string) {
  doc.save().font("Courier").fontSize(7).fillColor(hex(C.slate)).text(text.toUpperCase(),{characterSpacing:0.8}).restore();
  doc.moveDown(0.1);
}

function bodyText(doc: PDFKit.PDFDocument, text: string) {
  doc.save().font("Helvetica").fontSize(9.5).fillColor(hex(C.ink)).text(text,{lineGap:2}).restore();
  doc.moveDown(0.4);
}

function drawTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], colWidths: number[]) {
  const PAD_X=6, PAD_Y=4, MIN_H=18; let y=doc.y;
  doc.save().fillColor(hex(C.surface)).rect(ML,y,COL_W,MIN_H).fill().restore();
  hrule(doc,y,C.rule,0.5);
  headers.forEach((h,i)=>{
    const cx=ML+colWidths.slice(0,i).reduce((a,b)=>a+b,0);
    doc.save().font("Courier").fontSize(7).fillColor(hex(C.slate))
      .text(h.toUpperCase(),cx+PAD_X,y+PAD_Y,{width:colWidths[i]-PAD_X*2,lineBreak:false,characterSpacing:0.6}).restore();
  });
  y+=MIN_H; hrule(doc,y,C.rule,0.5);
  rows.forEach((row,ri)=>{
    let rowH=MIN_H;
    row.forEach((cell,ci)=>{ const h=doc.heightOfString(String(cell??""),{width:colWidths[ci]-PAD_X*2})+PAD_Y*2; if(h>rowH)rowH=h; });
    if(y+rowH>PAGE_H-MT){doc.addPage();y=MT;}
    doc.save().fillColor(ri%2===0?hex(C.white):hex(C.paper)).rect(ML,y,COL_W,rowH).fill().restore();
    row.forEach((cell,ci)=>{
      const cx=ML+colWidths.slice(0,ci).reduce((a,b)=>a+b,0);
      doc.save().font("Helvetica").fontSize(9).fillColor(hex(C.ink))
        .text(String(cell??""),cx+PAD_X,y+PAD_Y,{width:colWidths[ci]-PAD_X*2,lineGap:1}).restore();
    });
    y+=rowH; hrule(doc,y,C.rule,0.3);
  });
  doc.y=y; doc.moveDown(0.8);
}

function buildCover(doc: PDFKit.PDFDocument, p: {projectName:string;referenceCode:string;framework:string;frameworkFull:string;generatedAt:string;projectType:string;location:string;client:string;operator:string}) {
  const coverH=PAGE_H*0.56;
  doc.save().fillColor(hex(C.ink)).rect(0,0,PAGE_W,coverH).fill().restore();
  doc.save().font("Helvetica").fontSize(7.5).fillColor("#FFFFFF").opacity(0.35)
    .text("IMPACT DRIVER x UPTONVILLE NIGERIA LIMITED",ML,36,{characterSpacing:1.4}).restore();
  doc.save().font("Helvetica").fontSize(7.5).fillColor(hex(C.accent)).opacity(1)
    .text("IMPACT INTELLIGENCE FRAMEWORK",ML,50,{characterSpacing:1.2}).restore();
  hrule(doc,66,"#FFFFFF",0.25);
  doc.save().font("Courier").fontSize(8.5).fillColor(hex(C.accent))
    .text(p.framework+" DISCLOSURE REPORT",ML,80,{characterSpacing:1.0}).restore();
  doc.save().font("Times-Bold").fontSize(28).fillColor(hex(C.white))
    .text(p.projectName,ML,98,{width:COL_W,lineGap:3}).restore();
  doc.font("Times-Bold").fontSize(28);
  const titleH=doc.heightOfString(p.projectName,{width:COL_W});
  doc.save().font("Helvetica").fontSize(11).fillColor("#FFFFFF").opacity(0.5)
    .text(p.frameworkFull,ML,98+titleH+8).restore();
  const gridY=coverH-96;
  hrule(doc,gridY,"#FFFFFF",0.25);
  const fmtD=(iso:string)=>new Date(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});
  const meta=[["Reference code",p.referenceCode],["Date generated",fmtD(p.generatedAt)],["Project type",p.projectType],["Location",p.location],["Client",p.client],["Operator",p.operator]];
  const colW2=COL_W/2;
  meta.forEach(([lbl,val],i)=>{
    const col=i%2, row=Math.floor(i/2), gx=ML+col*(colW2+14), gy=gridY+12+row*26;
    doc.save().font("Courier").fontSize(7).fillColor("#FFFFFF").opacity(0.3).text(lbl.toUpperCase(),gx,gy,{characterSpacing:0.7}).restore();
    doc.save().font("Helvetica").fontSize(9).fillColor("#FFFFFF").opacity(0.8).text(val,gx,gy+10).restore();
  });
  const footerY=PAGE_H-42;
  hrule(doc,footerY,C.rule,0.5);
  doc.save().font("Helvetica").fontSize(7.5).fillColor(hex(C.slate))
    .text("Confidential -- for authorised recipients only",ML,footerY+10,{continued:true})
    .text("  Generated "+p.generatedAt.slice(0,10),{align:"right"}).restore();
}

function buildPdf(data:{
  meta:{projectName:string;referenceCode:string;framework:string;generatedAt:string;preparedBy:string};
  project:{projectType:string;location:string;operatingEnvironment:string;client:string;operator:string;description:string;duration:{start:string;end?:string}};
  disclosureItems:{disclosureTopic:string;alignedFramework:string;whyValuable:string}[];
  indicators:{indicatorName:string;category:string;unit:string;measurementMethod:string}[];
  regulations:{regulationStandard:string;issuingBody:string;howItApplied:string}[];
  stakeholders:{stakeholderGroup:string;interestConcern:string;reportingFormatNeeded:string}[];
  mitigationMeasures:{mitigationMeasure:string;effectiveness:string;evidenceForRating:string;recommendedFuture:string;expertReasoning:string}[];
  evidence:{regulationStandard:string;issuingBody:string;evidenceType:string;formatFrequency:string;acceptedWithoutDispute:boolean;disputeNotes?:string}[];
  environmentalOutcomes:{outcomesAchieved?:string;measurementMethod?:string;timeframe?:string;outstandingIssues?:string};
  socialImpacts:{positiveImpacts?:string;negativeImpacts?:string;grievanceMechanism?:string;grievanceOutcome?:string};
}):Promise<Buffer> {
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:"A4",margins:{top:MT,left:ML,right:MR,bottom:MT},autoFirstPage:false});
    const chunks:Buffer[]=[]; doc.on("data",(c:Buffer)=>chunks.push(c)); doc.on("end",()=>resolve(Buffer.concat(chunks))); doc.on("error",reject);
    const FW:Record<string,string>={GRI:"Global Reporting Initiative (GRI)",ISSB:"IFRS Sustainability Disclosure Standards (ISSB)",IFC:"IFC Performance Standards",TNFD:"Taskforce on Nature-related Financial Disclosures (TNFD)",NUPRC:"NUPRC Environmental Guidelines"};
    const fmtDate=(iso:string)=>new Date(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});
    doc.addPage();
    buildCover(doc,{projectName:data.meta.projectName,referenceCode:data.meta.referenceCode,framework:data.meta.framework,frameworkFull:FW[data.meta.framework]??data.meta.framework,generatedAt:data.meta.generatedAt,projectType:data.project.projectType,location:data.project.location,client:data.project.client,operator:data.project.operator});
    doc.addPage();
    const rh=()=>{ doc.save().font("Courier").fontSize(7).fillColor(hex(C.slate)).text("IIF  "+data.meta.referenceCode+"  "+data.meta.framework,ML,24).restore(); hrule(doc,38,C.rule,0.4); };
    doc.on("pageAdded",rh); rh(); doc.y=MT;
    sectionHeader(doc,"01","Project Overview");
    if(data.project.description)bodyText(doc,data.project.description);
    drawTable(doc,["Field","Detail"],[["Operating environment",data.project.operatingEnvironment],["Duration",fmtDate(data.project.duration.start)+(data.project.duration.end?" - "+fmtDate(data.project.duration.end):" - ongoing")],["Prepared by",data.meta.preparedBy]],[160,COL_W-160]);
    if(data.indicators.length>0){sectionHeader(doc,"02","ESG Indicators Tracked");drawTable(doc,["Cat.","Indicator name","Unit","Measurement method"],data.indicators.map(i=>[i.category,i.indicatorName,i.unit,i.measurementMethod]),[32,172,82,COL_W-286]);}
    if(data.regulations.length>0){sectionHeader(doc,"03","Regulatory Compliance");drawTable(doc,["Regulation / standard","Issuing body","Application"],data.regulations.map(r=>[r.regulationStandard,r.issuingBody,r.howItApplied]),[170,110,COL_W-280]);}
    if(data.stakeholders.length>0){sectionHeader(doc,"04","Stakeholder Engagement");drawTable(doc,["Stakeholder group","Interest / concern","Reporting format"],data.stakeholders.map(s=>[s.stakeholderGroup,s.interestConcern,s.reportingFormatNeeded]),[130,162,COL_W-292]);}
    if(data.mitigationMeasures.length>0){sectionHeader(doc,"05","Mitigation Measures & Decision Support");drawTable(doc,["Mitigation measure","Effectiveness","Evidence for rating","Recommended for future?"],data.mitigationMeasures.map(m=>[m.mitigationMeasure,m.effectiveness.toUpperCase(),m.evidenceForRating,m.recommendedFuture]),[140,56,118,COL_W-314]);}
    if(data.evidence.length>0){sectionHeader(doc,"06","Regulatory Evidence");drawTable(doc,["Regulation / standard","Issuing body","Evidence type","Format / frequency","Accepted?"],data.evidence.map(e=>[e.regulationStandard,e.issuingBody,e.evidenceType,e.formatFrequency,(e.acceptedWithoutDispute?"Yes":"No")+(e.disputeNotes?" — "+e.disputeNotes:"")]),[110,70,90,88,COL_W-358]);}
    if(data.environmentalOutcomes?.outcomesAchieved){sectionHeader(doc,"07","Environmental Outcomes");fieldLabel(doc,"Outcomes achieved");bodyText(doc,data.environmentalOutcomes.outcomesAchieved);if(data.environmentalOutcomes.timeframe){fieldLabel(doc,"Timeframe");bodyText(doc,data.environmentalOutcomes.timeframe);}if(data.environmentalOutcomes.measurementMethod){fieldLabel(doc,"Measurement method");bodyText(doc,data.environmentalOutcomes.measurementMethod);}if(data.environmentalOutcomes.outstandingIssues){fieldLabel(doc,"Outstanding issues");bodyText(doc,data.environmentalOutcomes.outstandingIssues);}}
    if(data.socialImpacts?.positiveImpacts){sectionHeader(doc,"08","Social Impacts");fieldLabel(doc,"Positive impacts");bodyText(doc,data.socialImpacts.positiveImpacts);if(data.socialImpacts.negativeImpacts){fieldLabel(doc,"Negative impacts");bodyText(doc,data.socialImpacts.negativeImpacts);}if(data.socialImpacts.grievanceMechanism){fieldLabel(doc,"Grievance mechanism");bodyText(doc,data.socialImpacts.grievanceMechanism);}if(data.socialImpacts.grievanceOutcome){fieldLabel(doc,"Grievance outcome");bodyText(doc,data.socialImpacts.grievanceOutcome);}}
    if(data.disclosureItems.length>0){sectionHeader(doc,"09",data.meta.framework+" Disclosure Topics");drawTable(doc,["Disclosure topic","Value to platform"],data.disclosureItems.map(d=>[d.disclosureTopic,d.whyValuable]),[200,COL_W-200]);}
    doc.moveDown(1); hrule(doc,doc.y,C.rule,0.5); doc.moveDown(0.5);
    doc.save().font("Helvetica").fontSize(7.5).fillColor(hex(C.slate)).text("This report was generated by the Impact Intelligence Framework on "+fmtDate(data.meta.generatedAt)+". Based on data extracted from project records held by Uptonville Nigeria Limited. For authorised recipients only.",{lineGap:2}).restore();
    doc.end();
  });
}

export async function generatePdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, framework } = req.query;
    if(!projectId||!framework){res.status(400).json({error:"projectId and framework are required"});return;}
    const [project,template]=await Promise.all([Project.findById(projectId).lean(),ProjectTemplate.findOne({project:projectId}).lean()]);
    if(!project||!template){res.status(404).json({error:"Project or template not found"});return;}
    const fw=framework as string;
    const sG=(template.sectionG??{}) as {outcomesAchieved?:string;measurementMethod?:string;timeframe?:string;outstandingIssues?:string};
    const sH=(template.sectionH??{}) as {positiveImpacts?:string;negativeImpacts?:string;grievanceMechanism?:string;grievanceOutcome?:string};
    const pdf=await buildPdf({
      meta:{projectName:project.name,referenceCode:project.referenceCode,framework:fw,generatedAt:new Date().toISOString(),preparedBy:"Impact Driver × Uptonville Nigeria Limited"},
      project:{projectType:project.projectType,location:project.location,operatingEnvironment:project.operatingEnvironment,client:project.client,operator:project.operator,description:project.description,duration:{start:project.duration.start.toISOString(),end:project.duration.end?.toISOString()}},
      disclosureItems:(template.sectionI??[]).filter(d=>d.alignedFramework===fw),
      indicators:template.sectionB??[],
      regulations:template.sectionC??[],
      stakeholders:template.sectionD??[],
      mitigationMeasures:template.sectionE??[],
      evidence:template.sectionF??[],
      environmentalOutcomes:sG,
      socialImpacts:sH,
    });
    const filename="IIF-"+project.referenceCode+"-"+fw+"-"+new Date().toISOString().slice(0,10)+".pdf";
    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Content-Disposition",`attachment; filename="${filename}"`);
    res.setHeader("Content-Length",pdf.length);
    res.send(pdf);
  } catch(err){next(err);}
}
