export const cnnTasks = [
  ['Now Free for Everyone','Law'],
  ['Not as Good as Before','Education'],
  ['Going Green with the Groceries','Environment'],
  ['The Long Way Back','Pets'],
  ['Protective Restrictions','Social Media'],
  ['More Expensive than Expected','Sport'],
  ['A Master of Memory','Board Games'],
  ['Sustainable Sightseeing','Tourism'],
  ['Preserving the Giants','Wildlife'],
  ['New Research on Prehistoric Killer','Planetary Science'],
  ['High-Tech Use for Low-Tech Material','Space'],
  ['Taking Care of Yourself','Wildlife'],
  ['A Basic Necessity beyond Reach','Resources'],
  ['Building Blocs','International Relations'],
  ['A Catch-and-Bury Approach','Environment'],
  ['Toward New Powers','Brain Technology'],
  ['Signs of an Ancient Shift','Geography'],
  ['Crucial Backup','Agriculture'],
  ['Finally Free','Law'],
  ['A Growing Gap','International Relations'],
  ['CNN Reading 21','News'],['CNN Reading 22','News'],['CNN Reading 23','News'],['CNN Reading 24','News'],['CNN Reading 25','News'],
  ['CNN Reading 26','News'],['CNN Reading 27','News'],['CNN Reading 28','News'],['CNN Reading 29','News'],['CNN Reading 30','News']
].map((x,i)=>({week:i+1,title:x[0],category:x[1]}));

export function demoAssignments(){
  const start = new Date(); start.setDate(start.getDate()-56);
  return cnnTasks.map((t,i)=>{
    const due = new Date(start); due.setDate(start.getDate()+i*7+6); due.setHours(23,59,0,0);
    const release = new Date(start); release.setDate(start.getDate()+i*7);
    return {id:`demo-a-${i+1}`,class_id:'demo-class',week_no:i+1,title:t.title,category:t.category,release_at:release.toISOString(),due_at:due.toISOString(),is_published:true,copeak_url:null};
  });
}
export const demoStudents = [
  {id:'s1',display_name:'Yuki Tanaka'},{id:'s2',display_name:'Kota Suzuki'},{id:'s3',display_name:'Mei Sato'},{id:'s4',display_name:'Haruto Ito'},{id:'s5',display_name:'Aoi Kato'}
];
export function demoSubmissions(){
  const rows=[];
  const counts={s1:8,s2:8,s3:9,s4:7,s5:9};
  demoStudents.forEach((s,si)=>{
    for(let i=0;i<counts[s.id];i++){
      if(s.id==='s2'&&i===5) continue;
      rows.push({id:`${s.id}-${i}`,student_id:s.id,assignment_id:`demo-a-${i+1}`,accuracy:Math.min(99,82+((i*3+si*5)%16)),wpm:90+((i*7+si*9)%45),comprehension:76+((i*4+si*3)%21),attempt_no:1,submitted_at:new Date(Date.now()-(10-i)*86400000).toISOString()});
    }
  });
  return rows;
}
