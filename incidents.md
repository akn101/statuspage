#### 4/12/2022 22:00hrs PT

Fixed

We are unable to allocate VMs to run Databricks jobs. This will cause all analytics to be delayed. We have identified the root-cause to be a bug on Azure Billing side and have engaged with the Azure support team to resolve this as soon as possible.

4/13/2022 15:30hrs PT Still working with Azure on resolution. We are running a pared down data pipeline to unblock everyone, while in parallel we figure out a full solution.

20:00hrs PT The Azure issues have been resolved. Analytics are being processed and are catching back up. Incident impact was limited to processing delays; no data was lost.

4/14/2022 15:00hrs All services back to normal. 

#### 4/07/2022 10:00hrs PT

Fixed

An outage on Azure's Events Hub has impacted real time event streaming in Statsig, and outgoing integrations which replay events.

We're actively monitoring the issue and attempting to replay missing integration data.

12:00 All services back to normal

