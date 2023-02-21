import { Injectable } from "@angular/core";
import { Observable, throwError } from "rxjs";
import { catchError, finalize } from "rxjs/operators";
import { DataService } from "src/app/common/services/data/data.service";
// import { ApiEndpoint } from "./api.endpoints";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  constructor(public data: DataService) {}
<% for(let service of services) {  %><% if(service.method == 'get') { %>
<%= service.name %>(options?: any): Observable<any> {
    this.data.serviceStarted();
    options === undefined
      ? (options = this.data.defaultOptions)
      : (options = this.data.setOptions(options));
    return this.data.getData('<%= service.path %>', options).pipe(
      finalize(() => this.data.serviceCompleted()),
      catchError((err) => {
        options? options.hideErrorMethod ? '' : this.data.errorMethod(err): '';
        return throwError(err);
      })
    );
}
<% } else { %> 
<%= service.name %>(body: any, options?: any): Observable<any> {
    this.data.serviceStarted();
    options === undefined
      ? (options = this.data.defaultOptions)
      : (options = this.data.setOptions(options));
    return this.data
      .postData('<%= service.path %>', body, options)
      .pipe(
        finalize(() => this.data.serviceCompleted()),
        catchError((err) => {
          options? options.hideErrorMethod ? '' : this.data.errorMethod(err): '';
          return throwError(err);
        })
      );
}
<% } %> <% } %>
}
