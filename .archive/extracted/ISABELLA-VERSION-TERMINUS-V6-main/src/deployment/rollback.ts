export interface Release{version:string;commitSha:string;createdAt:string;healthy:boolean;}
export class RollbackRegistry{
 private current?:Release; private previous?:Release;
 promote(next:Release):void{if(!next.healthy)throw new Error("ROLLBACK: unhealthy release cannot be promoted");this.previous=this.current;this.current=next;}
 rollback():Release{if(!this.previous)throw new Error("ROLLBACK: no previous healthy release");this.current=this.previous;return this.current;}
 status(){return{current:this.current,previous:this.previous};}
}