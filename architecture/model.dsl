workspace "Project Manager" "Sprint work, KPIs, AI sprint insights, manager Q&A, and Telegram task bot." {
    !adrs doc/arch
    model {
        developer = person "Developer" "Manages tasks and views personal KPIs via Telegram or the web application." "Person"
        manager = person "Manager" "Plans team tasks and sprints, monitors KPIs and AI sprint insights, uses manager chat." "Person"
        administrator = person "Administrator" "Creates projects and teams, assigns members, maintains catalog data." "Person"

        telegram = softwareSystem "Telegram" "Messaging app for task-bot commands and replies." "External System"
        gemini = softwareSystem "Google Gemini API" "Embeddings and generated text for insights and manager chat." "External System"

        taskManager = softwareSystem "Task Manager" "Plans and tracks work, KPIs, AI sprint narratives, manager chat over task data, and Telegram bot flows." {
            reactApp = container "React Frontend" "Web UI for tasks, KPIs, AI insights, manager chat, radar, and admin." "React 18" "Web Browser, Container, Single-page application"
            apiApp = container "Spring Boot Backend" "Business logic, HTTP APIs, jobs, Telegram bot, and AI orchestration." "Java 17, Spring Boot" "Container, Server-side application" {
                kpiApi = component "KPI API" "Exposes productivity and delivery metrics; supports on-demand KPI refresh." "Spring REST"
                managerChatApi = component "Manager chat API" "Entry point for contextual manager chat over project and sprint data." "Spring REST"
                insightsApi = component "Sprint insights API" "Starts and reads asynchronous sprint narratives; serves developer radar views." "Spring REST"
                embeddingsApi = component "Embeddings API" "Builds and refreshes task embeddings for semantic search." "Spring REST"
                domainApi = component "Domain API" "Tasks, projects, sprints, teams, users, assignments, admin, and legacy task list." "Spring REST"

                telegramBot = component "Telegram bot" "Receives messages and runs bot command flows." "TelegramBots SDK"
                taskOps = component "Task operations" "Creates and updates tasks from the bot." "Spring Service"
                sprintContext = component "Sprint context" "Handles sprint selection in bot flows." "Spring Service"
                assignments = component "Assignments" "Reads and updates user–task and sprint-task data for the bot." "Spring Service"
                userDirectory = component "User directory" "Resolves users for bot menus." "Spring Service"
                telegramIdentity = component "Telegram identity bridge" "Links Telegram chats to application users." "Spring Service"

                kpiEngine = component "KPI engine" "Computes and stores sprint KPI fields from aggregates." "Spring Service"
                sprintAi = component "Sprint AI orchestration" "Builds insight prompts, calls the LLM, stores sprint narratives." "Spring Service"
                semanticRetrieval = component "Semantic retrieval" "Embeds text and finds similar stored tasks." "Spring Service"
                chatOrchestration = component "Chat orchestration" "Builds retrieval context and calls the LLM for manager chat." "Spring Service"

                dataRepo = component "Data Repository" "Persists domain data, such as projects, tasks, and sprint KPI snapshots." "Spring Data JPA / JDBC"
            }

            database = container "Oracle Autonomous DB" "Stores application data, KPIs, AI insights, and task search vectors." "Oracle ADB" "Database"
        }

        developer -> reactApp "Views sprint tasks, personal KPIs, and sprint insight pages using the product interface"
        developer -> telegram "Lists and completes tasks, sends bot commands, and reads bot prompts in chat"
        manager -> reactApp "Manages backlog and sprints, reviews KPIs and sprint narratives, and uses manager chat using the product interface"
        manager -> telegram "Sends operator commands and reads team bot notifications in chat"
        administrator -> reactApp "Creates projects and teams, assigns members, and edits catalog master data using the product interface"

        reactApp -> kpiApi "Fetches KPI snapshots and requests KPI recomputation jobs using" "JSON / HTTPS"
        reactApp -> managerChatApi "Sends chat turns with project and optional sprint scope; receives assistant replies using" "JSON / HTTPS"
        reactApp -> insightsApi "Starts asynchronous insight jobs, reads sprint narratives, and loads developer radar views using" "JSON / HTTPS"
        reactApp -> embeddingsApi "Requests sprint-wide embedding rebuilds for semantic search using" "JSON / HTTPS"
        reactApp -> domainApi "Creates, reads, updates, and deletes tasks, projects, sprints, teams, users, assignments, profiles, and admin data using" "JSON / HTTPS"

        telegram -> telegramBot "Delivers inbound messages, edits, and callback queries to the task bot"
        telegramBot -> taskOps "Runs the parsed task command through the task operations service using"
        telegramBot -> sprintContext "Reads and stores which sprint this Telegram conversation is working in using"
        telegramBot -> assignments "Loads and updates assigned sprint work for the signed-in bot user using"
        telegramBot -> userDirectory "Loads directory information to render bot menus and roster pickers using"
        telegramBot -> telegramIdentity "Resolves which application account is linked to this Telegram chat using"

        taskOps -> dataRepo "Reads and writes task records affected by the bot command using" "JPA / JDBC"
        sprintContext -> dataRepo "Reads and updates the bot’s sprint selection state for the chat using" "JPA / JDBC"
        assignments -> dataRepo "Reads and updates assignment and sprint-task data for the acting user using" "JPA / JDBC"
        userDirectory -> dataRepo "Reads user directory data for bot menus using" "JPA / JDBC"
        telegramIdentity -> dataRepo "Reads and writes links between Telegram accounts and application users using" "JPA / JDBC"

        managerChatApi -> chatOrchestration "Routes browser chat traffic into orchestration using" "Spring"
        insightsApi -> sprintAi "Delegates sprint narrative generation to AI orchestration using" "Spring"

        embeddingsApi -> semanticRetrieval "Requests sprint-wide embedding build or refresh work using" "Spring"

        kpiApi -> kpiEngine "Invokes KPI recomputation and aggregate reads using" "Spring"
        kpiApi -> dataRepo "Runs KPI aggregates and reads stored KPI fields for API responses using" "JPA / JDBC"

        chatOrchestration -> semanticRetrieval "Turns the manager question into embeddings and retrieves similar tasks using" "Spring"
        semanticRetrieval -> gemini "Sends text to obtain embeddings and receives embedding vectors" "HTTPS"
        chatOrchestration -> dataRepo "Loads project, sprint, and ranked task excerpts for the composed prompt using" "JPA / JDBC"
        chatOrchestration -> gemini "Sends the composed prompt and receives the natural-language answer" "HTTPS"

        sprintAi -> gemini "Sends sprint insight prompts and receives generated narrative text" "HTTPS"
        sprintAi -> kpiEngine "Refreshes KPI aggregates for the sprint before assembling the prompt using" "Spring"
        sprintAi -> dataRepo "Loads sprint roster and context, then stores generated insight text using" "JPA / JDBC"

        kpiEngine -> dataRepo "Updates KPI fields and runs aggregate queries for KPI calculations using" "JPA / JDBC"

        semanticRetrieval -> dataRepo "Reads task content and stores embedding vectors for similarity search using" "JPA / JDBC"

        domainApi -> dataRepo "Reads from and writes to stored domain data through the data repository using" "JPA / JDBC"

        dataRepo -> database "Uses database connections to run queries and map results using" "Oracle / JDBC"

        deploymentEnvironment "Production" {
            deploymentNode "Oracle Cloud Infrastructure" {
                containerInstance database


                deploymentNode "Oracle Kubernetes Engine (OKE)" {
                    deploymentNode "Namespace mtdrworkshop" "Logical boundary in the cluster for the product’s workloads." "Kubernetes" {
                        productionLb = infrastructureNode "OCI load balancer" "Public entry point: OCI network load balancer forwards port 80 to the backend service port." "Kubernetes / OCI"

                        deploymentNode "Frontend Pod" {
                            productionWeb = containerInstance reactApp
                        }

                        deploymentNode "Backend Pod" "Spring Boot API workload running as two pod replicas." "Kubernetes" {
                            instances "2"
                            productionApi = containerInstance apiApp
                        }

                        productionLb -> productionApi "Routes inbound HTTP traffic to the API pods"
                    }
                }
            }
        }
    }

    views {
        # 1. System landscape — people, Task Manager, and external systems (same scope as course “Landscape” slide)
        systemLandscape "Landscape" "Developers, managers, and administrators use Task Manager alongside Telegram and Google Gemini." {
            include *
            autoLayout lr
        }

        # 2. System context
        systemContext taskManager "SystemContext" "Task Manager in its environment: users, Telegram, and Gemini." {
            include *
            autoLayout lr
        }

        # 3. Containers
        container taskManager "Containers" "Web UI, Spring Boot API, Oracle ADB, and external systems." {
            include *
            autoLayout lr
        }

        # 4. Components (inside Spring Boot)
        component apiApp "Components" "REST adapters, bot, domain services, AI orchestration, and persistence inside the API container." {
            include *
            autoLayout lr
        }

        # 5. Deployment
        deployment taskManager "Production" "Deployment" "OKE pods, load balancer, and Autonomous Database on OCI." {
            include *
            autoLayout lr
        }

        # 6a. Dynamic — RAG semantic chat
        dynamic apiApp "RAG_Insight_Flow" "Retrieves context before calling the LLM for manager chat." {
            managerChatApi -> chatOrchestration "User query received"
            chatOrchestration -> semanticRetrieval "Embed question and rank similar tasks"
            semanticRetrieval -> gemini "Call embedding API" "HTTPS"
            chatOrchestration -> dataRepo "Load top tasks and sprint context" "JPA / JDBC"
            chatOrchestration -> gemini "Call LLM with retrieved context" "HTTPS"
            autoLayout lr
        }

        dynamic apiApp "Sprint_Insights_Generation" "Background job: KPIs, context, LLM, save insight." {
            insightsApi -> sprintAi "Accepts generate narrative request"
            sprintAi -> kpiEngine "Refreshes KPI snapshot for sprint"
            sprintAi -> dataRepo "Loads sprint roster and task context" "JPA / JDBC"
            sprintAi -> gemini "Sends insight prompt and receives narrative" "HTTPS"
            sprintAi -> dataRepo "Persists insight result" "JPA / JDBC"
            autoLayout lr
        }

        dynamic apiApp "Embedding_Sprint_Index" "Embed all tasks in one sprint." {
            embeddingsApi -> semanticRetrieval "Accepts sprint embedding job"
            semanticRetrieval -> dataRepo "Loads task text for sprint" "JPA / JDBC"
            semanticRetrieval -> gemini "Obtains embedding vectors" "HTTPS"
            semanticRetrieval -> dataRepo "Stores vectors for search" "JPA / JDBC"
            autoLayout lr
        }

        dynamic apiApp "Telegram_Task_Command" "Resolve user then update tasks." {
            telegram -> telegramBot "Delivers message to bot"
            telegramBot -> telegramIdentity "Resolves linked application user"
            telegramIdentity -> dataRepo "Reads or updates Telegram account link" "JPA / JDBC"
            telegramBot -> taskOps "Runs task command workflow"
            taskOps -> dataRepo "Updates task records" "JPA / JDBC"
            autoLayout lr
        }

        dynamic apiApp "KPI_Calculation_Flow" "KPI recalculation and persistence." {
            kpiApi -> kpiEngine "Request KPI calculation for sprint"
            kpiEngine -> dataRepo "Aggregate metrics and update stored KPI values"
            autoLayout lr
        }

        styles {
            relationship "Relationship" {
                width 520
            }

            element "External System" {
                shape RoundedBox
                background #999999
                color #ffffff
                height 220
            }

            element "Software System" {
                shape RoundedBox
                height 320
            }

            element "Container" {
                shape RoundedBox
            }

            element "Component" {
                shape Component
            }

            element "Database" {
                shape Cylinder
            }

            element "Web Browser" {
                shape WebBrowser
            }

            element "Person" {
                shape Person
                background #08427b
                color #ffffff
                height 260
            }
        }
    }
}

